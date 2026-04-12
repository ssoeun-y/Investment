package se.sowl.sowenixApi.market.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import se.sowl.sowenixApi.common.CommonResponse;
import se.sowl.sowenixApi.market.service.MarketService;

@RestController
@RequestMapping("/api/market")
@RequiredArgsConstructor
public class MarketController {

    private final MarketService marketService;

    @GetMapping("/upbit")
    public Mono<CommonResponse<?>> getUpbit() {
        return marketService.getUpbitData()
                .map(CommonResponse::ok);
    }

    @GetMapping("/stock/{symbol}")
    public Mono<CommonResponse<?>> getStock(@PathVariable String symbol) {
        return marketService.getStockQuote(symbol)
                .map(CommonResponse::ok);
    }

    @GetMapping("/index/us")
    public Mono<CommonResponse<?>> getUsIndex() {
        return marketService.getUsIndexData()
                .map(CommonResponse::ok);
    }

    @GetMapping("/index/kr")
    public Mono<CommonResponse<?>> getKrIndex() {
        return marketService.getKrIndexData()
                .map(CommonResponse::ok);
    }

    @GetMapping("/all")
    public Mono<CommonResponse<?>> getAll() {
        return marketService.getAllMarketData()
                .map(CommonResponse::ok);
    }

    @GetMapping("/history")
    public Mono<CommonResponse<?>> getCrossMarketHistory(@RequestParam(defaultValue = "1") int days) {
        return marketService.getCrossMarketHistory(days)
                .map(CommonResponse::ok);
    }
}