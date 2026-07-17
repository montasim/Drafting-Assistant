import { Switch } from 'radix-ui';
import type { EngagementProfile } from '../domain/schemas';
import styles from './app.module.css';

interface Props {
  profile: EngagementProfile;
  onChange: (profile: EngagementProfile) => void;
}

export function ProfileEditor({ profile, onChange }: Props) {
  const update = <K extends keyof EngagementProfile>(key: K, value: EngagementProfile[K]) =>
    onChange({ ...profile, [key]: value, updatedAt: new Date().toISOString() });
  return (
    <div>
      <Field
        label="Current role"
        value={profile.role}
        onChange={(value) => update('role', value)}
      />
      <Field
        label="Industries (comma separated)"
        value={profile.industries.join(', ')}
        onChange={(value) => update('industries', split(value))}
      />
      <Field
        label="Expertise (comma separated)"
        value={profile.expertise.join(', ')}
        onChange={(value) => update('expertise', split(value))}
      />
      <Field
        label="Audience"
        value={profile.audience}
        onChange={(value) => update('audience', value)}
      />
      <Field
        label="Engagement goals (comma separated)"
        value={profile.goals.join(', ')}
        onChange={(value) => update('goals', split(value))}
      />
      <Field label="Tone" value={profile.tone} onChange={(value) => update('tone', value)} />
      <Field
        label="Preferred language (optional)"
        value={profile.preferredLanguage ?? ''}
        onChange={(value) => update('preferredLanguage', value || undefined)}
      />
      <Field
        label="Topics to avoid (comma separated)"
        value={profile.topicsToAvoid.join(', ')}
        onChange={(value) => update('topicsToAvoid', split(value))}
      />
      <div className={styles.between}>
        <span className={styles.label}>Allow emoji</span>
        <Switch.Root
          className={styles.switch}
          checked={profile.allowEmoji}
          onCheckedChange={(value) => update('allowEmoji', value)}
          aria-label="Allow emoji"
        >
          <Switch.Thumb className={styles.thumb} />
        </Switch.Root>
      </div>
      <div className={styles.between} style={{ marginTop: 12 }}>
        <span className={styles.label}>Allow hashtags</span>
        <Switch.Root
          className={styles.switch}
          checked={profile.allowHashtags}
          onCheckedChange={(value) => update('allowHashtags', value)}
          aria-label="Allow hashtags"
        >
          <Switch.Thumb className={styles.thumb} />
        </Switch.Root>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      <input
        className={styles.input}
        value={value}
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
