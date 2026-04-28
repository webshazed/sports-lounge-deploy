import { getInterviewBySlug } from "@/data/interviews";
import InterviewDetailPage from "./InterviewDetailPage";

export default function JulieToobyInterview() {
  const interview = getInterviewBySlug("julie-tooby");
  if (!interview) return null;
  return <InterviewDetailPage interview={interview} />;
}
