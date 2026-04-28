import { getInterviewBySlug } from "@/data/interviews";
import InterviewDetailPage from "./InterviewDetailPage";

export default function DanielleHobsonInterview() {
  const interview = getInterviewBySlug("danielle-hobson");
  if (!interview) return null;
  return <InterviewDetailPage interview={interview} />;
}
