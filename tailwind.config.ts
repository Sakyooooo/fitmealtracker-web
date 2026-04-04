import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        meal: '#4CAF50',
        'meal-light': '#E8F5E9',
        'meal-dark': '#388E3C',
        exercise: '#FF7043',
        'exercise-light': '#FFF3E0',
        'exercise-dark': '#E64A19',
      },
    },
  },
  plugins: [],
};

export default config;
