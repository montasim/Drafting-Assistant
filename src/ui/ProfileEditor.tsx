import { Switch } from 'radix-ui';
import type { EngagementProfile } from '../domain/schemas';
import styles from './styles';

interface Props {
  profile: EngagementProfile;
  onChange: (profile: EngagementProfile) => void;
}

export function ProfileEditor({ profile, onChange }: Props) {
  const update = <K extends keyof EngagementProfile>(key: K, value: EngagementProfile[K]) =>
    onChange({ ...profile, [key]: value, updatedAt: new Date().toISOString() });
  return (
    <div className={styles.profileEditor}>
      <section className={styles.profileSection}>
        <div className={styles.profileSectionHeading}>
          <span>01</span>
          <div>
            <b>Your professional lens</b>
            <small>What gives your perspective credibility?</small>
          </div>
        </div>
        <Field
          label="Current role"
          value={profile.role}
          placeholder="e.g. Senior Software Engineer"
          onChange={(value) => update('role', value)}
        />
        <Field
          label="Industries"
          hint="Separate multiple entries with commas"
          value={profile.industries.join(', ')}
          placeholder="e.g. Healthcare, SaaS, Developer tools"
          onChange={(value) => update('industries', split(value))}
        />
        <Field
          label="Expertise"
          hint="The topics you can speak about with confidence"
          value={profile.expertise.join(', ')}
          placeholder="e.g. React, product architecture, AI"
          onChange={(value) => update('expertise', split(value))}
        />
      </section>
      <section className={styles.profileSection}>
        <div className={styles.profileSectionHeading}>
          <span>02</span>
          <div>
            <b>How you want to engage</b>
            <small>Shape the intent behind each response.</small>
          </div>
        </div>
        <Field
          label="Audience"
          value={profile.audience}
          placeholder="Who do you usually want to reach?"
          onChange={(value) => update('audience', value)}
        />
        <Field
          label="Engagement goals"
          hint="Separate multiple goals with commas"
          value={profile.goals.join(', ')}
          placeholder="e.g. Share insight, learn, build relationships"
          onChange={(value) => update('goals', split(value))}
        />
        <Field
          label="Tone"
          value={profile.tone}
          placeholder="e.g. Warm, precise, curious"
          onChange={(value) => update('tone', value)}
        />
        <Field
          label="Preferred language (optional)"
          value={profile.preferredLanguage ?? ''}
          placeholder="Leave blank to mirror the conversation"
          onChange={(value) => update('preferredLanguage', value || undefined)}
        />
      </section>
      <section className={styles.profileSection}>
        <div className={styles.profileSectionHeading}>
          <span>03</span>
          <div>
            <b>Your boundaries</b>
            <small>Make “not my style” explicit.</small>
          </div>
        </div>
        <Field
          label="Topics to avoid"
          hint="Separate multiple topics with commas"
          value={profile.topicsToAvoid.join(', ')}
          placeholder="e.g. Politics, confidential client details"
          onChange={(value) => update('topicsToAvoid', split(value))}
        />
        <div className={styles.preferenceRow}>
          <div>
            <b>Allow emoji</b>
            <small>Use sparingly when the context feels natural</small>
          </div>
          <Switch.Root
            className={styles.switch}
            checked={profile.allowEmoji}
            onCheckedChange={(value) => update('allowEmoji', value)}
            aria-label="Allow emoji"
          >
            <Switch.Thumb className={styles.thumb} />
          </Switch.Root>
        </div>
        <div className={styles.preferenceRow}>
          <div>
            <b>Allow hashtags</b>
            <small>Include only when they add discoverability</small>
          </div>
          <Switch.Root
            className={styles.switch}
            checked={profile.allowHashtags}
            onCheckedChange={(value) => update('allowHashtags', value)}
            aria-label="Allow hashtags"
          >
            <Switch.Thumb className={styles.thumb} />
          </Switch.Root>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  hint,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  hint?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {hint && <small className={styles.fieldHint}>{hint}</small>}
      <input
        className={styles.input}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function split(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
