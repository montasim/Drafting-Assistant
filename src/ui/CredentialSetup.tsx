import React from 'react';
import styles from './styles';

type Provider = 'gemini' | 'groq';

const PROVIDER_GUIDE = {
  gemini: {
    name: 'Gemini',
    href: 'https://aistudio.google.com/apikey',
    linkLabel: 'Open Google AI Studio',
    steps: [
      'Sign in, accept the Gemini API terms, and open API Keys.',
      'Create a new auth key in a dedicated project. New AI Studio keys are restricted to the Gemini API by default.',
      'Copy the key once, return here, and paste it into the Gemini API key field.',
    ],
  },
  groq: {
    name: 'Groq',
    href: 'https://console.groq.com/keys',
    linkLabel: 'Open GroqCloud API Keys',
    steps: [
      'Sign in to GroqCloud and select the project you want this extension to use.',
      'Choose Create API Key, give it a recognizable name, and create it.',
      'Copy the key once, return here, and paste it into the Groq API key field.',
    ],
  },
} as const;

export function ApiKeyGuide({ provider }: { provider: Provider }) {
  const guide = PROVIDER_GUIDE[provider];
  return (
    <details className={styles.keyGuide}>
      <summary>How to get a {guide.name} API key</summary>
      <div>
        <ol>
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <a href={guide.href} target="_blank" rel="noreferrer">
          {guide.linkLabel} ↗
        </a>
      </div>
    </details>
  );
}
