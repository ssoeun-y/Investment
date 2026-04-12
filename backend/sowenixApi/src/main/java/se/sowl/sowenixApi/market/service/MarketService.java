package se.sowl.sowenixApi.market.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MarketService {

    private final WebClient.Builder webClientBuilder;

    @Value("${finnhub.api.key}")
    private String finnhubKey;

    private static final String FINNHUB_URL = "https://finnhub.io/api/v1";
    private static final String UPBIT_URL = "https://api.upbit.com/v1";

    // ── 메모리 캐시
    private Map<String, Object> cachedAllData = null;
    private final Map<Integer, Map<String, Object>> cachedHistory = new HashMap<>();
    private long lastAllDataTime = 0;
    private final Map<Integer, Long> lastHistoryTime = new HashMap<>();
    private static final long CACHE_TTL = 1 * 60 * 1000; // 1분

    // ── 업비트 코인 현재가 (KRW)
    public Mono<List<Map<String, Object>>> getUpbitData() {
        String markets = "KRW-BTC,KRW-ETH,KRW-XRP,KRW-SOL,KRW-DOGE";
        String url = UPBIT_URL + "/ticker?markets=" + markets;

        return webClientBuilder.build()
                .get()
                .uri(url)
                .header("Accept", "application/json")
                .retrieve()
                .bodyToMono(String.class)
                .doOnNext(s -> log.info("업비트 RAW 응답: {}", s.substring(0, Math.min(200, s.length()))))
                .map(s -> {
                    try {
                        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                        List<Map<String, Object>> list = mapper.readValue(s, new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>(){});
                        List<Map<String, Object>> result = new ArrayList<>();
                        for (Map<String, Object> node : list) {
                            String market = String.valueOf(node.get("market"));
                            String symbol = market.replace("KRW-", "");
                            double price = toDouble(node.get("trade_price"));
                            double changeRate = toDouble(node.get("signed_change_rate")) * 100;
                            double volume = toDouble(node.get("acc_trade_price_24h"));
                            Map<String, Object> item = new HashMap<>();
                            item.put("symbol", symbol);
                            item.put("name", symbol);
                            item.put("price", price);
                            item.put("change24h", changeRate);
                            item.put("volume", volume);
                            result.add(item);
                        }
                        log.info("업비트 파싱 성공: {}개", result.size());
                        return result;
                    } catch (Exception e) {
                        log.error("업비트 파싱 에러: {}", e.getMessage());
                        return List.<Map<String, Object>>of();
                    }
                })
                .doOnError(e -> log.error("업비트 호출 에러: {}", e.getMessage()))
                .onErrorReturn(List.of());
    }

    // ── 업비트 BTC 히스토리 (차트용)
    public Mono<Map<String, Object>> getCrossMarketHistory(int days) {
        long now = System.currentTimeMillis();
        Long lastTime = lastHistoryTime.getOrDefault(days, 0L);
        if (cachedHistory.containsKey(days) && (now - lastTime) < CACHE_TTL) {
            log.info("캐시 반환 (history days={})", days);
            return Mono.just(cachedHistory.get(days));
        }

        // 업비트 BTC 캔들
        int count = days <= 1 ? 24 : days * 24;
        String unit = days <= 1 ? "60" : "240"; // 1일: 60분봉, 그 이상: 240분봉
        String btcUrl = UPBIT_URL + "/candles/minutes/" + unit + "?market=KRW-BTC&count=" + Math.min(count, 200);

        Mono<List<List<Double>>> btcMono = webClientBuilder.build()
                .get()
                .uri(btcUrl)
                .header("Accept", "application/json")
                .retrieve()
                .bodyToFlux(Map.class)
                .map(candle -> {
                    String timeStr = String.valueOf(candle.get("candle_date_time_utc"));
                    long ts = java.time.Instant.parse(timeStr + "Z").toEpochMilli();
                    double price = toDouble(candle.get("trade_price"));
                    return List.of((double) ts, price);
                })
                .collectList()
                .map(list -> {
                    // 업비트는 최신순으로 오므로 역순 정렬
                    List<List<Double>> sorted = new ArrayList<>(list);
                    sorted.sort(Comparator.comparingDouble(l -> l.get(0)));
                    return sorted;
                })
                .doOnError(e -> log.error("업비트 BTC 히스토리 에러: {}", e.getMessage()))
                .onErrorResume(e -> {
                    if (cachedHistory.containsKey(days)) {
                        Object cached = cachedHistory.get(days).get("btc");
                        return Mono.just(cached != null ? (List<List<Double>>) cached : List.of());
                    }
                    return Mono.just(List.of());
                });

        String yahooInterval = days <= 1 ? "1h" : "1d";
        String yahooRange = days <= 1 ? "1d" : days + "d";
        Mono<List<List<Double>>> nasdaqMono = fetchYahooHistory("^IXIC", yahooInterval, yahooRange);
        Mono<List<List<Double>>> kospiMono  = fetchYahooHistory("^KS11", yahooInterval, yahooRange);

        return Mono.zip(btcMono, nasdaqMono, kospiMono)
                .map(tuple -> {
                    log.info("btc: {}, nasdaq: {}, kospi: {}",
                            tuple.getT1().size(), tuple.getT2().size(), tuple.getT3().size());
                    Map<String, Object> result = new HashMap<>();
                    result.put("btc",    tuple.getT1());
                    result.put("nasdaq", tuple.getT2());
                    result.put("kospi",  tuple.getT3());
                    cachedHistory.put(days, result);
                    lastHistoryTime.put(days, System.currentTimeMillis());
                    return result;
                })
                .onErrorResume(e -> {
                    log.error("히스토리 에러, 캐시 반환: {}", e.getMessage());
                    if (cachedHistory.containsKey(days)) return Mono.just(cachedHistory.get(days));
                    return Mono.error(e);
                });
    }

    // ── 미국 개별 주식 (Finnhub)
    public Mono<Map<String, Object>> getStockQuote(String symbol) {
        String url = FINNHUB_URL + "/quote?symbol=" + symbol + "&token=" + finnhubKey;

        return webClientBuilder.build()
                .get()
                .uri(url)
                .retrieve()
                .bodyToMono(Map.class)
                .map(node -> {
                    double current = toDouble(node.get("c"));
                    double prev    = toDouble(node.get("pc"));
                    double change  = prev > 0 ? ((current - prev) / prev) * 100 : 0;
                    Map<String, Object> result = new HashMap<>();
                    result.put("symbol", symbol);
                    result.put("price", current);
                    result.put("change", change);
                    result.put("high", node.get("h"));
                    result.put("low", node.get("l"));
                    result.put("prevClose", prev);
                    return (Map<String, Object>) result;
                })
                .onErrorReturn(getMockStockData(symbol));
    }

    // ── 미국 지수
    public Mono<List<Map<String, Object>>> getUsIndexData() {
        return Mono.zip(
                getStockQuote("QQQ"),
                getStockQuote("SPY")
        ).map(tuple -> List.of(
                Map.of("name", "나스닥", "symbol", "QQQ", "price", tuple.getT1().get("price"), "change", tuple.getT1().get("change")),
                Map.of("name", "S&P500", "symbol", "SPY", "price", tuple.getT2().get("price"), "change", tuple.getT2().get("change"))
        ));
    }

    // ── 한국 지수
    public Mono<List<Map<String, Object>>> getKrIndexData() {
        return Mono.zip(
                fetchYahooIndex("^KS11", "코스피"),
                fetchYahooIndex("^KQ11", "코스닥")
        ).map(tuple -> List.of(tuple.getT1(), tuple.getT2()));
    }

    // ── 전체 통합 (캐시 5분)
    public Mono<Map<String, Object>> getAllMarketData() {
        long now = System.currentTimeMillis();
        if (cachedAllData != null && (now - lastAllDataTime) < CACHE_TTL) {
            log.info("캐시 반환 (market/all)");
            return Mono.just(cachedAllData);
        }
        return Mono.zip(
                getUpbitData(),
                getStockQuote("NVDA"),
                getStockQuote("AAPL"),
                getStockQuote("TSLA"),
                getUsIndexData(),
                getKrIndexData()
        ).map(tuple -> {
            Map<String, Object> all = new HashMap<>();
            all.put("crypto",  tuple.getT1()); // 업비트 데이터
            all.put("upbit",   tuple.getT1()); // 동일 데이터 upbit 키로도 제공
            all.put("stocks",  List.of(tuple.getT2(), tuple.getT3(), tuple.getT4()));
            all.put("usIndex", tuple.getT5());
            all.put("krIndex", tuple.getT6());
            cachedAllData = all;
            lastAllDataTime = System.currentTimeMillis();
            log.info("캐시 갱신 (market/all)");
            return all;
        }).onErrorResume(e -> {
            log.error("getAllMarketData 에러, 캐시 반환: {}", e.getMessage());
            if (cachedAllData != null) return Mono.just(cachedAllData);
            return Mono.error(e);
        });
    }

    // ── Yahoo 히스토리
    private Mono<List<List<Double>>> fetchYahooHistory(String ticker, String interval, String range) {
        String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + ticker
                + "?interval=" + interval + "&range=" + range;
        log.info("Yahoo 히스토리 호출: {}", url);
        return webClientBuilder.build()
                .get()
                .uri(url)
                .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                .header("Accept", "application/json")
                .retrieve()
                .bodyToMono(Map.class)
                .map(root -> {
                    try {
                        Map chart = (Map) root.get("chart");
                        List results = (List) chart.get("result");
                        if (results == null || results.isEmpty()) return List.<List<Double>>of();
                        Map result = (Map) results.get(0);
                        List timestamps = (List) result.get("timestamp");
                        if (timestamps == null) return List.<List<Double>>of();
                        Map indicators = (Map) result.get("indicators");
                        List quotes = (List) indicators.get("quote");
                        Map quote = (Map) quotes.get(0);
                        List closes = (List) quote.get("close");
                        log.info("Yahoo {} 성공, 데이터 수: {}", ticker, timestamps.size());
                        List<List<Double>> data = new ArrayList<>();
                        for (int i = 0; i < timestamps.size(); i++) {
                            if (i < closes.size() && closes.get(i) != null) {
                                double ts = ((Number) timestamps.get(i)).doubleValue() * 1000.0;
                                double price = ((Number) closes.get(i)).doubleValue();
                                data.add(List.of(ts, price));
                            }
                        }
                        return data;
                    } catch (Exception e) {
                        log.error("Yahoo 파싱 에러 ({}): {}", ticker, e.getMessage());
                        return List.<List<Double>>of();
                    }
                })
                .doOnError(e -> log.error("Yahoo 호출 실패 ({}): {}", ticker, e.getMessage()))
                .onErrorReturn(List.of());
    }

    // ── Yahoo 지수 현재가
    private Mono<Map<String, Object>> fetchYahooIndex(String ticker, String label) {
        String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + ticker + "?interval=1d&range=1d";
        return webClientBuilder.build()
                .get()
                .uri(url)
                .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                .header("Accept", "application/json")
                .retrieve()
                .bodyToMono(Map.class)
                .map(root -> {
                    try {
                        Map chart = (Map) root.get("chart");
                        List results = (List) chart.get("result");
                        Map result = (Map) results.get(0);
                        Map meta = (Map) result.get("meta");
                        double price = toDouble(meta.get("regularMarketPrice"));
                        double prev  = toDouble(meta.get("chartPreviousClose"));
                        double change = prev > 0 ? ((price - prev) / prev) * 100 : 0;
                        Map<String, Object> item = new HashMap<>();
                        item.put("name", label);
                        item.put("price", price);
                        item.put("change", change);
                        log.info("{} 실시간: {}", label, price);
                        return item;
                    } catch (Exception e) {
                        log.error("{} 파싱 에러: {}", label, e.getMessage());
                        return getMockKrIndex(label);
                    }
                })
                .onErrorReturn(getMockKrIndex(label));
    }

    // ── 유틸
    private double toDouble(Object val) {
        if (val == null) return 0.0;
        if (val instanceof Number) return ((Number) val).doubleValue();
        try { return Double.parseDouble(val.toString()); } catch (Exception e) { return 0.0; }
    }

    // ── Mock 데이터
    private Map<String, Object> getMockStockData(String symbol) {
        Map<String, Map<String, Object>> mocks = Map.of(
                "NVDA", Map.of("symbol","NVDA","price",875.4,"change",3.21),
                "AAPL", Map.of("symbol","AAPL","price",196.8,"change",-0.45),
                "TSLA", Map.of("symbol","TSLA","price",248.5,"change",1.87),
                "QQQ",  Map.of("symbol","QQQ","price",445.2,"change",0.83),
                "SPY",  Map.of("symbol","SPY","price",524.1,"change",0.52)
        );
        return mocks.getOrDefault(symbol, Map.of("symbol",symbol,"price",0.0,"change",0.0));
    }

    private Map<String, Object> getMockKrIndex(String name) {
        if (name.equals("코스피")) return new HashMap<>(Map.of("name","코스피","price",2712.34,"change",0.43));
        return new HashMap<>(Map.of("name","코스닥","price",876.12,"change",-0.21));
    }
}