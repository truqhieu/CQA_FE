import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: (failureCount, error) => {
              const status = (error as { response?: { status?: number } })?.response?.status
              if (status === 429 || status === 401 || status === 403) return false
              return failureCount < 2
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
