import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useEffect } from "react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: isUserLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    if (user && !isUserLoading) {
      setLocation("/");
    }
    // setLocation is intentionally omitted — wouter's setter is not stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserLoading]);

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
          setLocation("/");
        },
      }
    );
  }

  if (isUserLoading) return <div className="min-h-screen bg-background flex items-center justify-center" />;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-border bg-card p-8 rounded-xl shadow-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-mono font-bold text-foreground mb-2 tracking-tight">TERMINAL.LOGIN</h1>
          <p className="text-muted-foreground text-sm">Authenticate to access real-time market data.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground font-mono uppercase text-xs tracking-wider">Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="trader@example.com" {...field} className="font-mono bg-background border-muted-foreground/30 focus-visible:ring-primary" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full font-mono uppercase tracking-wider font-bold" 
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Authenticating..." : "Sign In"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
