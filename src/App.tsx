import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import OnlineNow from "./pages/OnlineNow";
import Messages from "./pages/Messages";
import Contact from "./pages/Contact.tsx";
import Partners from "./pages/Partners.tsx";
import Register from "./pages/Register.tsx";
import SignIn from "./pages/SignIn.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Membership from "./pages/Membership.tsx";
import RequireAuth from "@/components/RequireAuth";
import RequireSubscription from "@/components/RequireSubscription";
import Profile from "./pages/Profile";
import Members from "./pages/Members";
import BookTable from "./pages/lounge/BookTable";
import MatchSchedule from "./pages/lounge/MatchSchedule";
import MemberPerks from "./pages/lounge/MemberPerks";
import Events from "./pages/Events";
import LiveMatches from "./pages/LiveMatches";
import BusinessHub from "./pages/BusinessHub";
import Leaderboard from "./pages/Leaderboard";
import Lounges from "./pages/Lounges";
import Saved from "./pages/Saved";
import NotFound from "./pages/NotFound.tsx";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import SessionWarning from "@/components/SessionWarning";

/** Wrapper that mounts the session guard (must be inside BrowserRouter) */
function SessionGuardWrapper({ children }: { children: React.ReactNode }) {
  const session = useSessionGuard();
  return (
    <>
      {children}
      <SessionWarning {...session} />
    </>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionGuardWrapper>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/register" element={<Register />} />

          {/* Membership page — requires auth but NOT subscription */}
          <Route
            path="/membership"
            element={
              <RequireAuth>
                <Membership />
              </RequireAuth>
            }
          />

          {/* All social platform routes — require auth + active subscription */}
          <Route
            path="/online"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <OnlineNow />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/messages"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <Messages />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <Dashboard />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <Profile />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/profile/:username"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <Profile />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/members"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <Members />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/lounge/book"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <BookTable />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/lounge/matches"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <MatchSchedule />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/lounge/perks"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <MemberPerks />
                </RequireSubscription>
              </RequireAuth>
            }
          />

          <Route
            path="/events"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <Events />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/matches"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <LiveMatches />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/business"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <BusinessHub />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <Leaderboard />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/lounges"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <Lounges />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          <Route
            path="/saved"
            element={
              <RequireAuth>
                <RequireSubscription>
                  <Saved />
                </RequireSubscription>
              </RequireAuth>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </SessionGuardWrapper>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
