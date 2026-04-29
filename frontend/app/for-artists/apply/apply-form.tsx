"use client";

import { useState } from "react";
import { submitArtistApplicationAction } from "./actions";

const GENRES = [
  "Country",
  "Pop",
  "Hip-Hop",
  "R&B",
  "Indie",
  "Rock",
  "Folk",
  "Electronic",
  "Latin",
  "Jazz",
  "Gospel",
  "Other",
];

const DISTRIBUTION_OPTIONS = [
  "DistroKid",
  "Stem",
  "UnitedMasters",
  "TuneCore",
  "CD Baby",
  "Major label",
  "Self-distributed",
  "Other",
];

export default function ApplyForm() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={submitArtistApplicationAction}
      onSubmit={() => setSubmitting(true)}
      className="space-y-8"
    >
      <Section title="Artist basics">
        <Field label="Artist / band name *" name="display_name" required maxLength={120} />
        <Field
          label="Tagline (one short line)"
          name="tagline"
          maxLength={140}
          hint="e.g. Country, heart-first."
        />
        <Field
          label="Short bio"
          name="bio"
          textarea
          maxLength={1000}
          hint="A paragraph or two. The story, not the press release."
        />
        <Field
          label="Suggested slug"
          name="slug_suggestion"
          hint="Lowercase, dashes, no spaces. e.g. raelynn. We'll confirm before going live."
          maxLength={60}
        />
        <Field
          label="Hero image URL (optional)"
          name="hero_image"
          hint="Paste a public URL. You'll upload via /admin once approved."
        />
      </Section>

      <Section title="Primary contact">
        <Field label="Name *" name="contact_name" required maxLength={120} />
        <Field label="Email *" name="contact_email" type="email" required />
        <Field label="Phone" name="contact_phone" />
      </Section>

      <Section title="Music & team">
        <fieldset>
          <legend className="text-sm font-medium text-white/85">
            Genres (pick all that apply)
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <label
                key={g}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/80 hover:border-white/30"
              >
                <input
                  type="checkbox"
                  name={`genre_${g}`}
                  className="h-3 w-3 accent-aurora"
                />
                {g}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Manager / agency name" name="manager_name" maxLength={120} />
          <Field
            label="Manager email"
            name="manager_email"
            type="email"
          />
        </div>
        <Select
          label="Distribution platform"
          name="distribution"
          options={DISTRIBUTION_OPTIONS.map((o) => ({ value: o, label: o }))}
        />
        <Field
          label="Approx. monthly listeners"
          name="monthly_listeners"
          type="number"
          min={0}
          hint="Spotify, Apple Music — whichever number you have. Rough estimate is fine."
        />
        <Field
          label="Upcoming tour dates / shows"
          name="upcoming_tour"
          textarea
          maxLength={1500}
          hint="Free-form. Helps us turn on the smart event-match feature out of the gate."
        />
        <Checkbox
          label="Interested in launching a Founder tier (capped at 100 founding fans)"
          name="founder_tier_interest"
        />
      </Section>

      <Section title="Social handles">
        <p className="text-xs text-white/55">
          Paste full URLs. Leave blank for platforms you don&apos;t use.
        </p>
        {["Instagram", "TikTok", "Spotify", "Apple Music", "YouTube", "X", "Facebook"].map(
          (platform) => {
            const key = platform.toLowerCase().replace(/\s+/g, "");
            return (
              <Field
                key={platform}
                label={platform}
                name={`social_${key}`}
                type="url"
                hint={`https://${key}.com/yourartist`}
              />
            );
          },
        )}
      </Section>

      <Section title="The good stuff">
        <Field
          label="What makes your fanbase special?"
          name="community_pitch"
          textarea
          maxLength={1500}
          hint="Tell us about your superfans. The story you can't put in a bio."
        />
        <Field
          label="Expected launch date"
          name="expected_launch_date"
          hint="Free-form — 'next month', 'before the summer tour', or a specific date."
        />
        <Field
          label="How did you hear about us?"
          name="referral_source"
          hint="Who pointed you our way?"
        />
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-white/55">
          By submitting you agree we may contact the email above. We never
          share your data with third parties.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-gradient-to-r from-aurora to-ember px-6 py-3 text-sm font-semibold text-white shadow-glass transition hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit application →"}
        </button>
      </div>
    </form>
  );
}

// ─── Tiny field primitives ────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="glass-card space-y-4 rounded-2xl p-6">
      <legend className="text-xs uppercase tracking-[0.2em] text-white/60">
        {title}
      </legend>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  textarea,
  maxLength,
  min,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  maxLength?: number;
  min?: number;
  hint?: string;
}) {
  const id = `f_${name}`;
  return (
    <label htmlFor={id} className="block">
      <span className="block text-sm font-medium text-white/85">{label}</span>
      {hint && (
        <span className="mt-0.5 block text-[11px] text-white/45">{hint}</span>
      )}
      {textarea ? (
        <textarea
          id={id}
          name={name}
          required={required}
          maxLength={maxLength}
          rows={4}
          className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-aurora focus:outline-none focus:ring-1 focus:ring-aurora"
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          maxLength={maxLength}
          min={min}
          className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-aurora focus:outline-none focus:ring-1 focus:ring-aurora"
        />
      )}
    </label>
  );
}

function Select({
  label,
  name,
  options,
  required,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  const id = `f_${name}`;
  return (
    <label htmlFor={id} className="block">
      <span className="block text-sm font-medium text-white/85">{label}</span>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue=""
        className="mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:border-aurora focus:outline-none focus:ring-1 focus:ring-aurora"
      >
        <option value="" disabled>
          Choose one…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Checkbox({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex items-start gap-3 text-sm text-white/85">
      <input
        type="checkbox"
        name={name}
        className="mt-1 h-4 w-4 rounded border-white/30 bg-black/40 accent-aurora"
      />
      <span>{label}</span>
    </label>
  );
}
