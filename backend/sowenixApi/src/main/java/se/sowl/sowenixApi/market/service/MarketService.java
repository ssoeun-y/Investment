package se.sowl.sowenixApi.market.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import java.util.stream.Collectors;
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

    private Map<String, Object> cachedAllData = null;
    private final Map<Integer, Map<String, Object>> cachedHistory = new HashMap<>();
    private long lastAllDataTime = 0;
    private final Map<Integer, Long> lastHistoryTime = new HashMap<>();
    private static final long CACHE_TTL = 60 * 1000;

    // ── 업비트 코인 현재가
    public Mono<List<Map<String, Object>>> getUpbitData() {
        String markets = "KRW-BTC,KRW-ETH,KRW-XRP,KRW-SOL,KRW-DOGE";
        String url = UPBIT_URL + "/ticker?markets=" + markets;
        return webClientBuilder.build()
                .get().uri(url).header("Accept", "application/json")
                .retrieve().bodyToMono(String.class)
                .doOnNext(s -> log.info("업비트 RAW 응답: {}", s.substring(0, Math.min(200, s.length()))))
                .map(s -> {
                    try {
                        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                        List<Map<String, Object>> list = mapper.readValue(s,
                                new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {
                                });
                        List<Map<String, Object>> result = new ArrayList<>();
                        for (Map<String, Object> node : list) {
                            String market = String.valueOf(node.get("market"));
                            String symbol = market.replace("KRW-", "");
                            Map<String, Object> item = new HashMap<>();
                            item.put("symbol", symbol);
                            item.put("name", symbol);
                            item.put("price", toDouble(node.get("trade_price")));
                            item.put("change24h", toDouble(node.get("signed_change_rate")) * 100);
                            item.put("volume", toDouble(node.get("acc_trade_price_24h")));
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

    // ── BTC + 나스닥 + 코스피 히스토리
    public Mono<Map<String, Object>> getCrossMarketHistory(int days) {
        long now = System.currentTimeMillis();
        Long lastTime = lastHistoryTime.getOrDefault(days, 0L);
        if (cachedHistory.containsKey(days) && (now - lastTime) < CACHE_TTL) {
            log.info("캐시 반환 (history days={})", days);
            return Mono.just(cachedHistory.get(days));
        }

        int count = days <= 1 ? 24 : days * 24;
        String unit = days <= 1 ? "60" : "240";
        String btcUrl = UPBIT_URL + "/candles/minutes/" + unit + "?market=KRW-BTC&count=" + Math.min(count, 200);

        Mono<List<List<Double>>> btcMono = webClientBuilder.build()
                .get().uri(btcUrl).header("Accept", "application/json")
                .retrieve().bodyToFlux(Map.class)
                .map(candle -> {
                    String timeStr = String.valueOf(candle.get("candle_date_time_utc"));
                    long ts = java.time.Instant.parse(timeStr + "Z").toEpochMilli();
                    return List.of((double) ts, toDouble(candle.get("trade_price")));
                })
                .collectList()
                .map(list -> {
                    List<List<Double>> sorted = new ArrayList<>(list);
                    sorted.sort(Comparator.comparingDouble(l -> l.get(0)));
                    return sorted;
                })
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
        Mono<List<List<Double>>> kospiMono = fetchYahooHistory("^KS11", yahooInterval, yahooRange);

        return Mono.zip(btcMono, nasdaqMono, kospiMono)
                .map(tuple -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("btc", tuple.getT1());
                    result.put("nasdaq", tuple.getT2());
                    result.put("kospi", tuple.getT3());
                    cachedHistory.put(days, result);
                    lastHistoryTime.put(days, System.currentTimeMillis());
                    return result;
                })
                .onErrorResume(e -> {
                    log.error("히스토리 에러, 캐시 반환: {}", e.getMessage());
                    if (cachedHistory.containsKey(days))
                        return Mono.just(cachedHistory.get(days));
                    return Mono.error(e);
                });
    }

    // ── 미국 개별 주식 (Finnhub)
    public Mono<Map<String, Object>> getStockQuote(String symbol) {
        String url = FINNHUB_URL + "/quote?symbol=" + symbol + "&token=" + finnhubKey;
        return webClientBuilder.build()
                .get().uri(url).retrieve().bodyToMono(Map.class)
                .map(node -> {
                    double current = toDouble(node.get("c"));
                    double prev = toDouble(node.get("pc"));
                    double change = prev > 0 ? ((current - prev) / prev) * 100 : 0;
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
        return Mono.zip(getStockQuote("QQQ"), getStockQuote("SPY"))
                .map(tuple -> List.of(
                        Map.of("name", "나스닥", "symbol", "QQQ", "price", tuple.getT1().get("price"), "change",
                                tuple.getT1().get("change")),
                        Map.of("name", "S&P500", "symbol", "SPY", "price", tuple.getT2().get("price"), "change",
                                tuple.getT2().get("change"))));
    }

    // ── 한국 지수
    public Mono<List<Map<String, Object>>> getKrIndexData() {
        return Mono.zip(
                fetchYahooIndex("^KS11", "코스피"),
                fetchYahooIndex("^KQ11", "코스닥")).map(tuple -> List.of(tuple.getT1(), tuple.getT2()));
    }

    // ── 전체 통합 (삼성전자 + SK하이닉스 포함)
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
                getKrIndexData()).flatMap(
                        tuple -> Mono.zip(
                                fetchYahooIndex("005930.KS", "삼성전자"),
                                fetchYahooIndex("000660.KS", "SK하이닉스")).map(krStocks -> {
                                    Map<String, Object> samsung = new HashMap<>(krStocks.getT1());
                                    samsung.put("symbol", "005930");
                                    samsung.put("type", "kr_stock");

                                    Map<String, Object> hynix = new HashMap<>(krStocks.getT2());
                                    hynix.put("symbol", "000660");
                                    hynix.put("type", "kr_stock");

                                    Map<String, Object> all = new HashMap<>();
                                    all.put("crypto", tuple.getT1());
                                    all.put("upbit", tuple.getT1());
                                    all.put("stocks", List.of(tuple.getT2(), tuple.getT3(), tuple.getT4()));
                                    all.put("krStocks", List.of(samsung, hynix));
                                    all.put("usIndex", tuple.getT5());
                                    all.put("krIndex", tuple.getT6());
                                    cachedAllData = all;
                                    lastAllDataTime = System.currentTimeMillis();
                                    log.info("캐시 갱신 (market/all) + 한국주식");
                                    return all;
                                }))
                .onErrorResume(e -> {
                    log.error("getAllMarketData 에러, 캐시 반환: {}", e.getMessage());
                    if (cachedAllData != null)
                        return Mono.just(cachedAllData);
                    return Mono.error(e);
                });
    }

    // ── RiskScore
    public Map<String, Object> getRiskScore() {
        List<Map<String, Object>> coins = getUpbitData().block();
        if (coins == null || coins.isEmpty()) {
            return Map.of("score", 50, "level", "MEDIUM", "label", "데이터 없음", "color", "#f59e0b", "avgVolatility", 0.0,
                    "breakdown", List.of());
        }
        double avgVolatility = coins.stream()
                .filter(c -> c.get("change24h") != null)
                .mapToDouble(c -> Math.abs(((Number) c.get("change24h")).doubleValue()))
                .average().orElse(5.0);
        int score = (int) Math.min(100, (avgVolatility / 15.0) * 100);
        String level, label, color;
        if (score < 30) {
            level = "LOW";
            label = "안정";
            color = "#22c55e";
        } else if (score < 60) {
            level = "MEDIUM";
            label = "보통";
            color = "#f59e0b";
        } else if (score < 80) {
            level = "HIGH";
            label = "주의";
            color = "#f97316";
        } else {
            level = "EXTREME";
            label = "위험";
            color = "#ef4444";
        }
        List<Map<String, Object>> breakdown = coins.stream()
                .filter(c -> c.get("change24h") != null)
                .sorted((a, b) -> Double.compare(
                        Math.abs(((Number) b.get("change24h")).doubleValue()),
                        Math.abs(((Number) a.get("change24h")).doubleValue())))
                .limit(5)
                .map(c -> {
                    Map<String, Object> i = new HashMap<>();
                    i.put("symbol", c.getOrDefault("symbol", "?"));
                    i.put("change", c.get("change24h"));
                    return i;
                })
                .collect(Collectors.toList());
        Map<String, Object> result = new HashMap<>();
        result.put("score", score);
        result.put("level", level);
        result.put("label", label);
        result.put("color", color);
        result.put("avgVolatility", Math.round(avgVolatility * 100.0) / 100.0);
        result.put("breakdown", breakdown);
        return result;
    }

    // ── EventAlert
    public List<Map<String, Object>> getMarketEvents() {
        List<Map<String, Object>> coins = getUpbitData().block();
        List<Map<String, Object>> events = new ArrayList<>();
        if (coins == null)
            return events;
        for (Map<String, Object> coin : coins) {
            String symbol = String.valueOf(coin.getOrDefault("symbol", "?"));
            String name = String.valueOf(coin.getOrDefault("name", symbol));
            Object changeObj = coin.get("change24h");
            if (changeObj == null)
                continue;
            double change = ((Number) changeObj).doubleValue();
            if (change >= 10)
                events.add(Map.of("type", "SURGE", "severity", "HIGH", "symbol", symbol, "name", name, "value", change,
                        "message", String.format("%s 24h +%.1f%% 급등", symbol, change)));
            else if (change <= -10)
                events.add(Map.of("type", "CRASH", "severity", "HIGH", "symbol", symbol, "name", name, "value", change,
                        "message", String.format("%s 24h %.1f%% 급락", symbol, change)));
            else if (change >= 5)
                events.add(Map.of("type", "RISE", "severity", "MEDIUM", "symbol", symbol, "name", name, "value", change,
                        "message", String.format("%s 24h +%.1f%% 상승", symbol, change)));
            else if (change <= -5)
                events.add(Map.of("type", "DROP", "severity", "MEDIUM", "symbol", symbol, "name", name, "value", change,
                        "message", String.format("%s 24h %.1f%% 하락", symbol, change)));
        }
        events.sort((a, b) -> Integer.compare("HIGH".equals(a.get("severity")) ? 0 : 1,
                "HIGH".equals(b.get("severity")) ? 0 : 1));
        log.info("[EventAlert] 이벤트 수: {}", events.size());
        return events;
    }

    // ── CorrMatrix (피어슨 상관계수)
    public Map<String, Object> getCorrelationMatrix() {
        Map<String, Object> history = getCrossMarketHistory(30).block();
        if (history == null)
            return Map.of("error", "히스토리 데이터 없음");

        double[] btc = extractPrices((List<List<Double>>) history.get("btc"));
        double[] nasdaq = extractPrices((List<List<Double>>) history.get("nasdaq"));
        double[] kospi = extractPrices((List<List<Double>>) history.get("kospi"));

        String[] assets = { "BTC", "NASDAQ", "KOSPI" };
        double[][] raw = {
                { 1.0, pearson(btc, nasdaq), pearson(btc, kospi) },
                { pearson(nasdaq, btc), 1.0, pearson(nasdaq, kospi) },
                { pearson(kospi, btc), pearson(kospi, nasdaq), 1.0 }
        };

        List<Map<String, Object>> cells = new ArrayList<>();
        for (int i = 0; i < assets.length; i++) {
            for (int j = 0; j < assets.length; j++) {
                Map<String, Object> cell = new HashMap<>();
                cell.put("x", assets[j]);
                cell.put("y", assets[i]);
                cell.put("value", Math.round(raw[i][j] * 100.0) / 100.0);
                cells.add(cell);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("assets", List.of(assets));
        result.put("cells", cells);
        result.put("updatedAt", System.currentTimeMillis());
        return result;
    }

    // ── Yahoo 히스토리
    private Mono<List<List<Double>>> fetchYahooHistory(String ticker, String interval, String range) {
        String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + ticker + "?interval=" + interval + "&range="
                + range;
        log.info("Yahoo 히스토리 호출: {}", url);
        return webClientBuilder.build()
                .get().uri(url)
                .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                .header("Accept", "application/json")
                .retrieve().bodyToMono(Map.class)
                .map(root -> {
                    try {
                        Map chart = (Map) root.get("chart");
                        List results = (List) chart.get("result");
                        if (results == null || results.isEmpty())
                            return List.<List<Double>>of();
                        Map result = (Map) results.get(0);
                        List timestamps = (List) result.get("timestamp");
                        if (timestamps == null)
                            return List.<List<Double>>of();
                        Map indicators = (Map) result.get("indicators");
                        List quotes = (List) indicators.get("quote");
                        Map quote = (Map) quotes.get(0);
                        List closes = (List) quote.get("close");
                        List<List<Double>> data = new ArrayList<>();
                        for (int i = 0; i < timestamps.size(); i++) {
                            if (i < closes.size() && closes.get(i) != null) {
                                data.add(List.of(((Number) timestamps.get(i)).doubleValue() * 1000.0,
                                        ((Number) closes.get(i)).doubleValue()));
                            }
                        }
                        log.info("Yahoo {} 성공, {}건", ticker, data.size());
                        return data;
                    } catch (Exception e) {
                        log.error("Yahoo 파싱 에러 ({}): {}", ticker, e.getMessage());
                        return List.<List<Double>>of();
                    }
                })
                .onErrorReturn(List.of());
    }

    // ── Yahoo 지수 현재가
    private Mono<Map<String, Object>> fetchYahooIndex(String ticker, String label) {
        String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + ticker + "?interval=1d&range=1d";
        return webClientBuilder.build()
                .get().uri(url)
                .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                .header("Accept", "application/json")
                .retrieve().bodyToMono(Map.class)
                .map(root -> {
                    try {
                        Map chart = (Map) root.get("chart");
                        List results = (List) chart.get("result");
                        Map result = (Map) results.get(0);
                        Map meta = (Map) result.get("meta");
                        double price = toDouble(meta.get("regularMarketPrice"));
                        double prev = toDouble(meta.get("chartPreviousClose"));
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
        if (val == null)
            return 0.0;
        if (val instanceof Number)
            return ((Number) val).doubleValue();
        try {
            return Double.parseDouble(val.toString());
        } catch (Exception e) {
            return 0.0;
        }
    }

    private double[] extractPrices(List<List<Double>> history) {
        if (history == null || history.isEmpty())
            return new double[0];
        return history.stream()
                .mapToDouble(point -> point.size() > 1 ? point.get(1) : 0.0)
                .toArray();
    }

    private double pearson(double[] x, double[] y) {
        int n = Math.min(x.length, y.length);
        if (n < 2)
            return 0.0;

        double meanX = 0, meanY = 0;
        for (int i = 0; i < n; i++) {
            meanX += x[i];
            meanY += y[i];
        }
        meanX /= n;
        meanY /= n;

        double num = 0, denX = 0, denY = 0;
        for (int i = 0; i < n; i++) {
            double dx = x[i] - meanX, dy = y[i] - meanY;
            num += dx * dy;
            denX += dx * dx;
            denY += dy * dy;
        }
        double den = Math.sqrt(denX * denY);
        return den == 0 ? 0.0 : Math.round((num / den) * 100.0) / 100.0;
    }

    private Map<String, Object> getMockStockData(String symbol) {
        Map<String, Map<String, Object>> mocks = Map.of(
                "NVDA", Map.of("symbol", "NVDA", "price", 875.4, "change", 3.21),
                "AAPL", Map.of("symbol", "AAPL", "price", 196.8, "change", -0.45),
                "TSLA", Map.of("symbol", "TSLA", "price", 248.5, "change", 1.87),
                "QQQ", Map.of("symbol", "QQQ", "price", 445.2, "change", 0.83),
                "SPY", Map.of("symbol", "SPY", "price", 524.1, "change", 0.52));
        return mocks.getOrDefault(symbol, Map.of("symbol", symbol, "price", 0.0, "change", 0.0));
    }

    private Map<String, Object> getMockKrIndex(String name) {
        if (name.equals("코스피"))
            return new HashMap<>(Map.of("name", "코스피", "price", 2712.34, "change", 0.43));
        if (name.equals("삼성전자"))
            return new HashMap<>(Map.of("name", "삼성전자", "price", 71400.0, "change", 0.56));
        if (name.equals("SK하이닉스"))
            return new HashMap<>(Map.of("name", "SK하이닉스", "price", 198000.0, "change", 1.23));
        return new HashMap<>(Map.of("name", "코스닥", "price", 876.12, "change", -0.21));
    }

    // ── 거래량 분석 (업비트 7일)
    public Map<String, Object> getVolumeData() {
        List<Map<String, Object>> coins = getUpbitData().block();
        if (coins == null || coins.isEmpty())
            return Map.of("error", "데이터 없음");

        // 코인별 24h 거래대금 합산
        double totalCryptoVolume = coins.stream()
                .mapToDouble(c -> toDouble(c.get("volume")))
                .sum();

        // 업비트 캔들로 7일 일별 코인 거래량 가져오기
        String url = UPBIT_URL + "/candles/days?market=KRW-BTC&count=7";
        List<Map<String, Object>> candles = webClientBuilder.build()
                .get().uri(url).header("Accept", "application/json")
                .retrieve().bodyToFlux(Map.class)
                .map(c -> {
                    Map<String, Object> item = new HashMap<>();
                    String dateStr = String.valueOf(c.get("candle_date_time_kst")).substring(0, 10);
                    item.put("date", dateStr);
                    item.put("cryptoVolume", Math.round(toDouble(c.get("candle_acc_trade_price")) / 100_000_000));
                    return (Map<String, Object>) item;
                })
                .collectList()
                .block();

        if (candles == null)
            candles = List.of();

        // 날짜 오름차순 정렬
        List<Map<String, Object>> sorted = new ArrayList<>(candles);
        sorted.sort(Comparator.comparing(c -> String.valueOf(c.get("date"))));

        List<String> labels = sorted.stream().map(c -> String.valueOf(c.get("date")).substring(5))
                .collect(Collectors.toList());
        List<Long> crypto = sorted.stream().map(c -> (Long) c.get("cryptoVolume")).collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("labels", labels);
        result.put("crypto", crypto);
        result.put("total24h", Math.round(totalCryptoVolume / 100_000_000));
        return result;
    }

    // ── 백테스팅 (MA5 전략 vs 단순 보유) — 일별 집계
    public Map<String, Object> getBacktestData() {
        Map<String, Object> history = getCrossMarketHistory(30).block();
        if (history == null)
            return Map.of("error", "데이터 없음");

        List<List<Double>> btcHistory = (List<List<Double>>) history.get("btc");
        if (btcHistory == null || btcHistory.size() < 6)
            return Map.of("error", "데이터 부족");

        // 일별 종가만 추출 (날짜 기준 마지막 값)
        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("MM/dd");
        LinkedHashMap<String, Double> dailyMap = new LinkedHashMap<>();
        for (List<Double> point : btcHistory) {
            String dateKey = sdf.format(new java.util.Date(point.get(0).longValue()));
            dailyMap.put(dateKey, point.get(1)); // 같은 날짜면 덮어쓰기 → 마지막(종가)
        }

        List<String> labels = new ArrayList<>(dailyMap.keySet());
        List<Double> prices = new ArrayList<>(dailyMap.values());

        if (prices.size() < 2)
            return Map.of("error", "데이터 부족");

        // 단순 보유
        double base = prices.get(0);
        List<Double> holdStrategy = prices.stream()
                .map(p -> Math.round((p / base) * 100.0 * 10) / 10.0)
                .collect(Collectors.toList());

        // MA5 전략
        List<Double> maStrategy = new ArrayList<>();
        double capital = 100.0;
        boolean inMarket = false;
        double buyPrice = 0;

        for (int i = 0; i < prices.size(); i++) {
            if (i < 4) {
                maStrategy.add(100.0);
                continue;
            }
            double ma5 = 0;
            for (int j = i - 4; j <= i; j++)
                ma5 += prices.get(j);
            ma5 /= 5;

            double cur = prices.get(i);
            double prev = prices.get(i - 1);

            if (!inMarket && cur > ma5 && prev <= ma5) {
                inMarket = true;
                buyPrice = cur;
            } else if (inMarket && cur < ma5) {
                capital *= (cur / buyPrice);
                inMarket = false;
                buyPrice = cur;
            }

            double current = inMarket ? capital * (cur / buyPrice) : capital;
            maStrategy.add(Math.round(current * 10.0) / 10.0);
        }

        double maReturn = maStrategy.get(maStrategy.size() - 1) - 100;
        double holdReturn = holdStrategy.get(holdStrategy.size() - 1) - 100;

        Map<String, Object> result = new HashMap<>();
        result.put("labels", labels);
        result.put("maStrategy", maStrategy);
        result.put("holdStrategy", holdStrategy);
        result.put("maReturn", Math.round(maReturn * 10.0) / 10.0);
        result.put("holdReturn", Math.round(holdReturn * 10.0) / 10.0);
        return result;
    }
}