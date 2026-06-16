import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { 
  useGetMe, getGetMeQueryKey,
  useListStocks, getListStocksQueryKey,
  useListSubscriptions, getListSubscriptionsQueryKey,
  useCreateSubscription,
  useDeleteSubscription,
  useLogout,
  useGetStockPrices, getGetStockPricesQueryKey,
  useGetPortfolio, getGetPortfolioQueryKey,
  useListTrades, getListTradesQueryKey,
  useExecuteTrade,
} from "@workspace/api-client-react";
import { useStockPrices } from "@/hooks/use-stock-prices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ArrowDownRight, Minus, LogOut, Activity, Bell, BellRing, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sparkline } from "@/components/sparkline";

function formatMoney(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(amount: number) {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toFixed(2)}%`;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: user, error: authError } = useGetMe({ 
    query: { queryKey: getGetMeQueryKey(), retry: false } 
  });
  
  const { data: stocks = [] } = useListStocks({
    query: { queryKey: getListStocksQueryKey(), enabled: !!user }
  });
  
  const { data: initialPrices = [] } = useGetStockPrices({
    query: { queryKey: getGetStockPricesQueryKey(), enabled: !!user }
  });

  const { data: subscriptions = [] } = useListSubscriptions({
    query: { queryKey: getListSubscriptionsQueryKey(), enabled: !!user }
  });

  const { data: portfolio } = useGetPortfolio({
    query: { queryKey: getGetPortfolioQueryKey(), enabled: !!user, refetchInterval: 3000 }
  });

  const { data: trades = [] } = useListTrades({
    query: { queryKey: getListTradesQueryKey(), enabled: !!user }
  });

  const createSub = useCreateSubscription();
  const deleteSub = useDeleteSubscription();
  const logoutMut = useLogout();
  const executeTrade = useExecuteTrade();
  
  const { prices: livePrices, history, alerts, setAlert } = useStockPrices();

  useEffect(() => {
    if (authError) {
      setLocation("/login");
    }
    // setLocation is intentionally omitted — wouter's setter is not stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authError]);

  useEffect(() => {
    const handleAlert = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      toast({
        title: "PRICE ALERT",
        description: `ALERT: ${detail.ticker} hit ${formatMoney(detail.price)}`,
        variant: "destructive",
      });
    };
    window.addEventListener('stock-alert', handleAlert);
    return () => window.removeEventListener('stock-alert', handleAlert);
  }, [toast]);

  const handleToggleSub = (ticker: string, isSubbed: boolean) => {
    if (isSubbed) {
      deleteSub.mutate({ ticker }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
        }
      });
    } else {
      createSub.mutate({ data: { ticker } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
        }
      });
    }
  };

  const handleLogout = () => {
    logoutMut.mutate(undefined, {
      onSuccess: () => {
        setLocation("/login");
      }
    });
  };

  const [tradeState, setTradeState] = useState<{ ticker: string, type: "buy" | "sell", shares: string } | null>(null);
  const [alertState, setAlertState] = useState<{ ticker: string, price: string } | null>(null);

  const handleTradeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!tradeState) return;
    const sharesNum = parseInt(tradeState.shares, 10);
    if (isNaN(sharesNum) || sharesNum <= 0) return;

    executeTrade.mutate({ data: { ticker: tradeState.ticker, type: tradeState.type, shares: sharesNum } }, {
      onSuccess: (trade) => {
        queryClient.invalidateQueries({ queryKey: getGetPortfolioQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
        toast({
          title: "Trade Executed",
          description: `${trade.type.toUpperCase()} ${trade.shares} ${trade.ticker} @ ${formatMoney(trade.price)}`,
        });
        setTradeState(null);
      },
      onError: () => {
        toast({ title: "Trade Failed", variant: "destructive" });
      }
    });
  };

  const handleAlertSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!alertState) return;
    const priceNum = parseFloat(alertState.price);
    if (!isNaN(priceNum)) {
      setAlert(alertState.ticker, priceNum);
    }
    setAlertState(null);
  };

  if (!user) {
    return <div className="min-h-screen bg-background" />;
  }

  const subscribedTickers = new Set(subscriptions.map(s => s.ticker));
  const subbedStocks = stocks.filter(s => subscribedTickers.has(s.ticker));
  const recentTrades = [...trades].reverse().slice(0, 10);

  const tickerItems = stocks.map(stock => {
    const p = livePrices[stock.ticker] || initialPrices.find(ip => ip.ticker === stock.ticker);
    return { stock, price: p };
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-mono text-sm selection:bg-primary/30">
      <header className="border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-50">
        <div className="px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <Activity className="h-5 w-5" />
            <span className="font-bold text-lg tracking-tighter">TERMINAL.LIVE</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground opacity-70 hidden sm:inline-block">{user.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="h-8 rounded-none border-border hover:bg-muted text-xs uppercase" data-testid="button-logout">
              <LogOut className="h-3 w-3 mr-2" /> EXIT
            </Button>
          </div>
        </div>
        
        {/* Scrolling Ticker Bar */}
        <div className="border-t border-border h-8 bg-muted/20 overflow-hidden flex items-center whitespace-nowrap relative">
          <div className="flex w-[200%] animate-ticker">
            {[...tickerItems, ...tickerItems].map((item, idx) => {
              if (!item.price) return null;
              const isUp = item.price.trend === "up";
              const color = isUp ? "text-primary" : item.price.trend === "down" ? "text-destructive" : "text-muted-foreground";
              return (
                <div key={`${item.stock.ticker}-${idx}`} className="flex items-center gap-2 px-6 border-r border-border/50 w-64 shrink-0">
                  <span className="font-bold">{item.stock.ticker}</span>
                  <span className="monospaced-nums">{item.price.price.toFixed(2)}</span>
                  <span className={`monospaced-nums text-xs ${color}`}>{isUp ? "+" : ""}{item.price.changePercent.toFixed(2)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="p-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Active Positions */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="uppercase tracking-widest text-muted-foreground font-bold">Active Positions</h2>
          </div>
          
          {subbedStocks.length === 0 ? (
            <div className="border border-dashed border-border p-8 text-center text-muted-foreground">
              NO ACTIVE SUBSCRIPTIONS
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {subbedStocks.map(stock => {
                const initialPrice = initialPrices.find(p => p.ticker === stock.ticker);
                const livePrice = livePrices[stock.ticker];
                const priceData = livePrice || initialPrice;
                const hist = history[stock.ticker] || [];
                const activeAlert = alerts[stock.ticker];
                
                if (!priceData) return null;

                const isUp = priceData.trend === "up";
                const isDown = priceData.trend === "down";
                const colorClass = isUp ? "text-primary" : isDown ? "text-destructive" : "text-muted-foreground";
                const hexColor = isUp ? "#22c55e" : isDown ? "#e11d48" : "#94a3b8";

                const isTrading = tradeState?.ticker === stock.ticker;
                const isAlerting = alertState?.ticker === stock.ticker;

                return (
                  <div key={stock.ticker} className="border border-border bg-card relative overflow-hidden flex flex-col">
                    <div className="p-4 z-10 flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold tracking-tight">{stock.ticker}</h3>
                          <p className="text-xs text-muted-foreground">{stock.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {activeAlert !== undefined && (
                            <span className="text-xs text-primary px-2 py-0.5 border border-primary/30 bg-primary/10 rounded-full flex items-center gap-1">
                              <BellRing className="w-3 h-3" /> {activeAlert.toFixed(2)}
                              <button onClick={() => setAlert(stock.ticker, null)} className="ml-1 hover:text-foreground">&times;</button>
                            </span>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setAlertState(isAlerting ? null : { ticker: stock.ticker, price: priceData.price.toFixed(2) })}
                            data-testid={`button-alert-${stock.ticker}`}
                          >
                            <Bell className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-end justify-between mt-2">
                        <div className="monospaced-nums text-4xl font-bold tracking-tighter">
                          {priceData.price.toFixed(2)}
                        </div>
                        <div className={`text-right flex flex-col items-end ${colorClass}`}>
                          <span className="text-base font-bold monospaced-nums">
                            {isUp ? "+" : ""}{priceData.change.toFixed(2)}
                          </span>
                          <span className="text-xs monospaced-nums">
                            {isUp ? "+" : ""}{priceData.changePercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 rounded-none border-primary/50 text-primary hover:bg-primary/20 hover:text-primary"
                          onClick={() => setTradeState({ ticker: stock.ticker, type: "buy", shares: "1" })}
                          data-testid={`button-buy-${stock.ticker}`}
                        >
                          BUY
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 rounded-none border-destructive/50 text-destructive hover:bg-destructive/20 hover:text-destructive"
                          onClick={() => setTradeState({ ticker: stock.ticker, type: "sell", shares: "1" })}
                          data-testid={`button-sell-${stock.ticker}`}
                        >
                          SELL
                        </Button>
                      </div>

                      {/* Inline Trade Panel */}
                      {isTrading && (
                        <form onSubmit={handleTradeSubmit} className="mt-2 p-3 bg-muted/20 border border-border flex items-end gap-2 animate-in fade-in slide-in-from-top-2">
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground uppercase mb-1 block">Shares to {tradeState.type}</label>
                            <Input 
                              type="number" 
                              min="1" 
                              value={tradeState.shares} 
                              onChange={(e) => setTradeState({ ...tradeState, shares: e.target.value })}
                              className="rounded-none h-8 bg-background monospaced-nums"
                              autoFocus
                              data-testid={`input-shares-${stock.ticker}`}
                            />
                          </div>
                          <Button type="submit" size="sm" className="rounded-none h-8 px-6" disabled={executeTrade.isPending} data-testid={`button-confirm-trade-${stock.ticker}`}>
                            CONFIRM
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setTradeState(null)} className="rounded-none h-8 px-2 text-muted-foreground">
                            &times;
                          </Button>
                        </form>
                      )}

                      {/* Inline Alert Panel */}
                      {isAlerting && (
                        <form onSubmit={handleAlertSubmit} className="mt-2 p-3 bg-muted/20 border border-border flex items-end gap-2 animate-in fade-in slide-in-from-top-2">
                          <div className="flex-1">
                            <label className="text-xs text-muted-foreground uppercase mb-1 block">Target Price Alert</label>
                            <Input 
                              type="number" 
                              step="0.01"
                              value={alertState.price} 
                              onChange={(e) => setAlertState({ ...alertState, price: e.target.value })}
                              className="rounded-none h-8 bg-background monospaced-nums"
                              autoFocus
                              data-testid={`input-alert-${stock.ticker}`}
                            />
                          </div>
                          <Button type="submit" size="sm" className="rounded-none h-8 px-6">
                            SET
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setAlertState(null)} className="rounded-none h-8 px-2 text-muted-foreground">
                            &times;
                          </Button>
                        </form>
                      )}
                    </div>
                    
                    {/* Sparkline Background */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 opacity-50 pointer-events-none">
                      <Sparkline data={hist} color={hexColor} width={800} height={64} className="w-full h-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Center Column: Portfolio & Trades */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="uppercase tracking-widest text-muted-foreground font-bold">Portfolio</h2>
          </div>
          
          <div className="border border-border bg-card flex flex-col">
            <div className="p-4 border-b border-border bg-muted/10">
              <div className="text-xs text-muted-foreground uppercase mb-1">Total Value</div>
              <div className="text-3xl font-bold tracking-tighter monospaced-nums">
                {formatMoney(portfolio?.totalValue || 0)}
              </div>
              <div className={`text-sm mt-1 font-bold monospaced-nums flex items-center gap-1 ${(portfolio?.totalPnl || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {(portfolio?.totalPnl || 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {formatMoney(portfolio?.totalPnl || 0)} ({formatPercent(portfolio?.totalPnlPercent || 0)})
              </div>
            </div>
            
            <div className="divide-y divide-border">
              {portfolio?.holdings.map(h => (
                <div key={h.ticker} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-sm">{h.ticker}</div>
                    <div className="text-muted-foreground">{h.shares} sh @ {formatMoney(h.avgCost)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold monospaced-nums">{formatMoney(h.totalValue)}</div>
                    <div className={`monospaced-nums ${h.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatMoney(h.pnl)}
                    </div>
                  </div>
                </div>
              ))}
              {(!portfolio?.holdings || portfolio.holdings.length === 0) && (
                <div className="p-4 text-center text-muted-foreground text-xs">No active holdings.</div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border pb-2 mt-4">
            <h2 className="uppercase tracking-widest text-muted-foreground font-bold">Recent Trades</h2>
          </div>
          
          <div className="border border-border bg-card text-xs overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground">
                  <th className="p-2 font-normal">TIME</th>
                  <th className="p-2 font-normal">SYM</th>
                  <th className="p-2 font-normal">SIDE</th>
                  <th className="p-2 font-normal text-right">QTY</th>
                  <th className="p-2 font-normal text-right">PRICE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentTrades.map(t => (
                  <tr key={t.id} className="hover:bg-muted/10">
                    <td className="p-2 text-muted-foreground">{new Date(t.executedAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td className="p-2 font-bold">{t.ticker}</td>
                    <td className={`p-2 font-bold ${t.type === 'buy' ? 'text-primary' : 'text-destructive'}`}>{t.type.toUpperCase()}</td>
                    <td className="p-2 text-right monospaced-nums">{t.shares}</td>
                    <td className="p-2 text-right monospaced-nums">{t.price.toFixed(2)}</td>
                  </tr>
                ))}
                {recentTrades.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">No trades executed today.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Market Index */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="uppercase tracking-widest text-muted-foreground font-bold">Market Index</h2>
          </div>
          <div className="border border-border bg-card flex flex-col">
            <div className="divide-y divide-border">
              {stocks.map(stock => {
                const isSubbed = subscribedTickers.has(stock.ticker);
                const isPending = createSub.isPending || deleteSub.isPending;
                const p = livePrices[stock.ticker] || initialPrices.find(ip => ip.ticker === stock.ticker);

                return (
                  <div key={stock.ticker} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 rounded border ${isSubbed ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}
                        disabled={isPending}
                        onClick={() => handleToggleSub(stock.ticker, isSubbed)}
                        data-testid={`button-sub-${stock.ticker}`}
                      >
                        {isSubbed ? <Minus className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                      </Button>
                      <div>
                        <div className="font-bold">{stock.ticker}</div>
                        {p && (
                          <div className={`text-xs monospaced-nums ${p.trend === 'up' ? 'text-primary' : p.trend === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {p.price.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
