import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { interviews, getInterviewPath } from "@/data/interviews";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function Interviews() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-[#3b5998]/10 blur-3xl" />
          <div className="absolute right-10 top-32 h-96 w-96 rounded-full bg-amber-200/35 blur-3xl" />
        </div>

        <div className="container relative z-10 mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto mb-14 max-w-3xl text-center"
          >
            <p className="section-label section-label-with-lines mb-4">Interviews</p>
            <h1 className="font-body mb-5 text-4xl font-bold text-slate-900 md:text-5xl">
              Member Interviews
            </h1>
            <p className="text-lg leading-relaxed text-slate-600">
              Browse the latest interviews from business and sports leaders, then open each story for the full conversation.
            </p>
          </motion.div>

          <div className="grid gap-8 lg:grid-cols-3">
            {interviews.map((interview, index) => (
              <motion.article
                key={interview.slug}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70"
              >
                <img
                  src={interview.image}
                  alt={interview.imageAlt}
                  className="h-80 w-full object-cover object-top"
                />

                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#3b5998]">
                    Featured Interview
                  </p>
                  <h2 className="mt-3 text-2xl font-bold leading-tight text-slate-900">
                    {interview.title}
                  </h2>
                  {interview.description && (
                    <p className="mt-3 text-sm leading-6 text-slate-600">{interview.description}</p>
                  )}

                  <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-lg font-bold text-slate-900">{interview.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-[#1e346b]">{interview.role}</p>
                    <div className="mt-4 space-y-3">
                      {interview.facts.map((fact) => (
                        <div key={fact.label}>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                            {fact.label}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-slate-700">{fact.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Link
                    to={getInterviewPath(interview.slug)}
                    className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#3b5998] to-[#1e346b] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#3b5998]/20 transition hover:brightness-110"
                  >
                    Read Interview
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <Footer lightText />
    </div>
  );
}
