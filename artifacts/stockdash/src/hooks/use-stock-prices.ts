import { useState, useEffect, useRef, useCallback } from 'react';
import type { StockPrice } from '@workspace/api-client-react';

const MAX_HISTORY = 60;

export function useStockPrices() {
  const [prices, setPrices] = useState<Record<string, StockPrice>>({});
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [alerts, setAlerts] = useState<Record<string, number>>({});
  
  const pricesRef = useRef(prices);
  pricesRef.current = prices;
  
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  const setAlert = useCallback((ticker: string, price: number | null) => {
    setAlerts(prev => {
      if (price === null) {
        const next = { ...prev };
        delete next[ticker];
        return next;
      }
      return { ...prev, [ticker]: price };
    });
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      socket = new WebSocket(wsUrl);
      
      socket.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data) as StockPrice;
          
          setPrices(prev => ({ ...prev, [update.ticker]: update }));
          
          setHistory(prev => {
            const hist = prev[update.ticker] || [];
            const next = [...hist, update.price];
            if (next.length > MAX_HISTORY) {
              next.shift();
            }
            return { ...prev, [update.ticker]: next };
          });

          const currentAlert = alertsRef.current[update.ticker];
          if (currentAlert !== undefined) {
            const oldPrice = pricesRef.current[update.ticker]?.price;
            if (oldPrice !== undefined) {
              // Crossed up or down
              const crossedUp = oldPrice < currentAlert && update.price >= currentAlert;
              const crossedDown = oldPrice > currentAlert && update.price <= currentAlert;
              const isNear = Math.abs(update.price - currentAlert) < currentAlert * 0.005;

              if (crossedUp || crossedDown || isNear) {
                window.dispatchEvent(new CustomEvent('stock-alert', { 
                  detail: { ticker: update.ticker, price: update.price } 
                }));
                // Clear the alert
                setAlert(update.ticker, null);
              }
            }
          }

        } catch (e) {}
      };

      socket.onclose = () => {
        reconnectTimeout = setTimeout(connect, 1000);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [setAlert]);

  return { prices, history, alerts, setAlert };
}
