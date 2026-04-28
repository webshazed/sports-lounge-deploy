import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { InterviewEntry } from "@/data/interviews";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function InterviewDetailPage({ interview }: { interview: InterviewEntry }) {
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
            className="mb-8"
          >
            <Link
              to="/interviews"
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#3b5998]/40 hover:text-[#1e346b]"
            >
              Back to Interviews
            </Link>
          </motion.div>

          <motion.article
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70"
          >
            <div className="grid gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
              <div className="border-b border-slate-200 bg-gradient-to-br from-slate-100 via-white to-slate-50 p-6 lg:border-b-0 lg:border-r">
                <img
                  src={interview.image}
                  alt={interview.imageAlt}
                  className="mb-6 h-[340px] w-full rounded-3xl object-cover object-top shadow-lg shadow-slate-300/40"
                />
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#3b5998]">
                    Featured Interview
                  </p>
                  <h1 className="text-2xl font-bold leading-tight text-slate-900">
                    {interview.title}
                  </h1>
                  {interview.description && (
                    <p className="text-base leading-relaxed text-slate-600">{interview.description}</p>
                  )}
                </div>

                <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900">{interview.name}</h2>
                  <p className="mt-1 text-sm font-semibold text-[#1e346b]">{interview.role}</p>
                  <div className="mt-5 space-y-4">
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

                {interview.extraImages && (
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    {interview.extraImages.map((extra) => (
                      <img
                        key={extra.src}
                        src={extra.src}
                        alt={extra.alt}
                        className="h-32 w-full rounded-2xl border border-slate-200 bg-white object-cover p-2"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 md:p-8 lg:p-10">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-6">
                    {interview.sections.map((section) => (
                      <section key={section.question} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                        <h3 className="text-lg font-bold text-slate-900">{section.question}</h3>
                        <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-700">
                          {section.answers.map((answer, answerIndex) => (
                            <p key={`${section.question}-${answerIndex}`}>{answer}</p>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>

                  <aside className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-[#1e346b] to-[#3b5998] p-5 text-white shadow-lg shadow-[#1e346b]/15">
                      <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/75">Quick Hits</p>
                      <div className="mt-4 space-y-4">
                        {interview.quickHits.map((item) => (
                          <div key={item.label}>
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
                              {item.label}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-white">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {interview.links?.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-[#1e346b] shadow-sm transition hover:-translate-y-0.5 hover:border-[#3b5998]/40 hover:shadow-md"
                      >
                        <span>{link.label}</span>
                        <span aria-hidden="true">-</span>
                      </a>
                    ))}

                  </aside>
                </div>
              </div>
            </div>
          </motion.article>
        </div>
      </section>

      <Footer lightText />
    </div>
  );
}
