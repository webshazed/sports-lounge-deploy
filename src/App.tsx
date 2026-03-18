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
import RequireAuth from "@/components/RequireAuth";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route
            path="/online"
            element={
              <RequireAuth>
                <OnlineNow />
              </RequireAuth>
            }
          />
          <Route
            path="/messages"
            element={
              <RequireAuth>
                <Messages />
              </RequireAuth>
            }
          />
          <Route path="/contact" element={<Contact />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/profile/:username"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/members"
            element={
              <RequireAuth>
                <Members />
              </RequireAuth>
            }
          />
          <Route
            path="/lounge/book"
            element={
              <RequireAuth>
                <BookTable />
              </RequireAuth>
            }
          />
          <Route
            path="/lounge/matches"
            element={
              <RequireAuth>
                <MatchSchedule />
              </RequireAuth>
            }
          />
          <Route
            path="/lounge/perks"
            element={
              <RequireAuth>
                <MemberPerks />
              </RequireAuth>
            }
          />

          <Route
            path="/events"
            element={
              <RequireAuth>
                <Events />
              </RequireAuth>
            }
          />
          <Route
            path="/matches"
            element={
              <RequireAuth>
                <LiveMatches />
              </RequireAuth>
            }
          />
          <Route
            path="/business"
            element={
              <RequireAuth>
                <BusinessHub />
              </RequireAuth>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <RequireAuth>
                <Leaderboard />
              </RequireAuth>
            }
          />
          <Route
            path="/lounges"
            element={
              <RequireAuth>
                <Lounges />
              </RequireAuth>
            }
          />
          <Route
            path="/saved"
            element={
              <RequireAuth>
                <Saved />
              </RequireAuth>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
