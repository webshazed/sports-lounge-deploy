import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { notifyAuthChanged } from "@/lib/auth";
import { countries } from "@/data/countries";
import {
  aboutYouOptions, individualMembershipTypes, businessMembershipTypes,
  businessTypes, sportsOptions, premierLeagueTeams, worldFootballTeams, genderOptions,
} from "@/data/formOptions";

type RegType = "individual" | "business";

const inputClass =
  "w-full bg-card border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground mb-2";
const checkboxWrap = "flex items-center gap-2 text-sm text-muted-foreground";

async function readJsonOrText<T>(res: Response): Promise<{ ok: true; json: T } | { ok: false; text: string }> {
  const text = await res.text();
  try {
    return { ok: true, json: JSON.parse(text) as T };
  } catch {
    return { ok: false, text };
  }
}

async function registerAccount(data: any) {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const parsed = await readJsonOrText<{ token: string; user: { id: number; email: string; username: string }; regType: string } | { error: string; details?: string }>(
    res
  );
  if (parsed.ok === false) {
    throw new Error(`Registration failed (${res.status}). ${parsed.text.slice(0, 200)}`);
  }
  const json = parsed.json;
  if (!res.ok) throw new Error("error" in json ? json.error : "Registration failed");
  return json as { token: string; user: { id: number; email: string; username: string }; regType: string };
}

const SelectField = ({
  label, options, value, onChange, placeholder = "- Select -",
}: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; placeholder?: string;
}) => (
  <div>
    <label className={labelClass}>{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </div>
);

const CheckboxGroup = ({
  label, options, selected, onChange,
}: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) => (
  <div className="bg-card border border-border p-6 rounded-md">
    <label className="block text-sm font-medium text-foreground mb-4">{label}</label>
    <div className="flex flex-wrap gap-2.5">
      {options.map((o) => (
        <label 
          key={o} 
          className={`cursor-pointer px-4 pt-1.5 pb-2 rounded-full border text-sm font-medium transition-colors ${
            selected.includes(o)
              ? "bg-slate-800 border-slate-800 text-white"
              : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={selected.includes(o)}
            onChange={(e) => {
              if (e.target.checked) onChange([...selected, o]);
              else onChange(selected.filter((s) => s !== o));
            }}
          />
          {o}
        </label>
      ))}
    </div>
  </div>
);

const Register = () => {
  const [regType, setRegType] = useState<RegType>("individual");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Shared fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [aboutYou, setAboutYou] = useState("");
  const [membershipType, setMembershipType] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [sports, setSports] = useState<string[]>([]);
  const [plTeam, setPlTeam] = useState<string[]>([]);
  const [worldTeam, setWorldTeam] = useState<string[]>([]);
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Business-only
  const [bizType, setBizType] = useState("");
  const [bizName, setBizName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await registerAccount({
        email, username, password,
        firstName, lastName, phone, dob, gender,
        aboutYou: aboutYou,
        favoriteSports: sports,
        membershipType,
        couponCode,
        plTeam: plTeam,
        worldTeam: worldTeam,
        addressLine1: address1,
        addressLine2: address2,
        city,
        zipCode: zip,
        country,
        bizType,
        bizName,
        regType
      });
      // Auto-login: store token and user data
      localStorage.setItem("auth_token", result.token);
      localStorage.setItem("auth_user", JSON.stringify(result.user));
      localStorage.setItem("reg_type", result.regType || regType);
      notifyAuthChanged();
      
      if (membershipType === "Coupon Code") {
        toast.success("Lifetime membership granted! Welcome to the club.");
        navigate("/dashboard");
      } else {
        toast.success("Registration successful! Choose your membership plan.");
        navigate("/membership");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-6 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <p className="section-label section-label-with-lines mb-4">Membership</p>
            <h1 className="font-body text-4xl md:text-5xl font-bold text-foreground mb-4">
              Become a Member
            </h1>
            <p className="text-muted-foreground">Choose your registration type to get started.</p>
          </motion.div>

          {/* Toggle */}
          <div className="flex justify-center gap-4 mb-10">
            {(["individual", "business"] as RegType[]).map((t) => (
              <button
                key={t}
                onClick={() => { setRegType(t); setMembershipType(""); }}
                className={`px-8 py-3 rounded border shadow-sm text-sm font-semibold tracking-wide transition-all duration-200 ${
                  regType === t
                    ? "bg-gradient-to-b from-[#3b5998] to-[#1e346b] border-[#1e346b] text-white hover:brightness-110 active:brightness-95"
                    : "bg-gradient-to-b from-[#333333] to-[#1a1a1a] border-[#111111] text-white hover:brightness-110 active:brightness-95"
                }`}
              >
                {t === "individual" ? "Individual Registration" : "Business Registration"}
              </button>
            ))}
          </div>

          <motion.form
            key={regType}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Name */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name</label>
                <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} placeholder="First Name" />
              </div>
              <div>
                <label className={labelClass}>Last Name</label>
                <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} placeholder="Last Name" />
              </div>
            </div>

            <SelectField label="About You" options={aboutYouOptions} value={aboutYou} onChange={setAboutYou} />

            <SelectField
              label="Membership Type"
              options={regType === "individual" ? individualMembershipTypes : businessMembershipTypes}
              value={membershipType}
              onChange={setMembershipType}
            />

            {membershipType === "Coupon Code" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden space-y-2">
                <label className={labelClass}>Enter Coupon Code</label>
                <input 
                  type="text" 
                  value={couponCode} 
                  required
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())} 
                  className={inputClass} 
                  placeholder="e.g. LIFETIME2026" 
                />
              </motion.div>
            )}

            {/* Business-only fields */}
            {regType === "business" && (
              <>
                <SelectField label="Type of Business / Organisation" options={businessTypes} value={bizType} onChange={setBizType} />
                <div>
                  <label className={labelClass}>Business Name</label>
                  <input type="text" value={bizName} onChange={(e) => setBizName(e.target.value)} className={inputClass} placeholder="Business Name" />
                </div>
              </>
            )}

            <CheckboxGroup label="What Sports Do You Follow" options={sportsOptions} selected={sports} onChange={setSports} />
            <CheckboxGroup label="Favourite Premier League Team" options={premierLeagueTeams} selected={plTeam} onChange={setPlTeam} />
            <CheckboxGroup label="Favourite World Football Team" options={worldFootballTeams} selected={worldTeam} onChange={setWorldTeam} />

            <SelectField label="Gender" options={genderOptions} value={gender} onChange={setGender} />

            <div>
              <label className={labelClass}>Date of Birth</label>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Address</h3>
              <input type="text" value={address1} onChange={(e) => setAddress1(e.target.value)} className={inputClass} placeholder="Address Line 1" />
              <input type="text" value={address2} onChange={(e) => setAddress2(e.target.value)} className={inputClass} placeholder="Address Line 2" />
              <div className="grid sm:grid-cols-2 gap-4">
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} placeholder="City" />
                <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} className={inputClass} placeholder="Zip Code" />
              </div>
              <SelectField label="Country" options={countries} value={country} onChange={setCountry} placeholder="Select Country" />
            </div>

            {/* Account */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Account Details</h3>
              <div>
                <label className={labelClass}>Username</label>
                <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} placeholder="Username" />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="Email" />
              </div>
              <div>
                <label className={labelClass}>Phone / Mobile</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="Phone / Mobile" />
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Password" />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full text-base py-4">
              {loading ? "Submitting..." : "Sign Up"}
            </button>
          </motion.form>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Register;
