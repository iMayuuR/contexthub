import { formatGreeting } from './helper';

export function runDemo(): void {
  const greeting = formatGreeting('Developer');
  console.log(greeting);
}

runDemo();
