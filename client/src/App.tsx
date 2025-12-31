import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Add pages below */}
      {/* <Route path="/" component={Home}/> */}
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex flex-col h-screen">
          <header className="flex items-center justify-end p-4 border-b">
            <a href="https://rivalishub1.netlify.app/" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="icon" data-testid="button-home">
                <Home className="h-4 w-4" />
              </Button>
            </a>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
