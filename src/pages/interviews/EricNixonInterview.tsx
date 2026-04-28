import { getInterviewBySlug } from "@/data/interviews";
import InterviewDetailPage from "./InterviewDetailPage";

export default function EricNixonInterview() {
  const interview = getInterviewBySlug("eric-nixon");
  if (!interview) return null;
  return <InterviewDetailPage interview={interview} />;
}
