import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { useState } from "react";
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
  <div>
    <label className={labelClass}>{label}</label>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map((o) => (
        <label key={o} className={checkboxWrap}>
          <input
            type="checkbox"
            checked={selected.includes(o)}
            onChange={(e) => {
              if (e.target.checked) onChange([...selected, o]);
              else onChange(selected.filter((s) => s !== o));
            }}
            className="rounded border-border text-primary focus:ring-primary"
          />
          {o}
        </label>
      ))}
    </div>
  </div>
);

const Register = () => {
  const [regType, setRegType] = useState<RegType>("individual");

  // Shared fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [aboutYou, setAboutYou] = useState("");
  const [membershipType, setMembershipType] = useState("");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Registration submitted! We'll review your application shortly.");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="pt-32 pb-24">
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
                className={`px-6 py-3 rounded-md text-sm font-semibold transition-all ${
                  regType === t
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
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
              Sign Up
            </button>
          </motion.form>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Register;
