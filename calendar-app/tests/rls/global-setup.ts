import { resetDatabase } from "./db";

export default async function setup(): Promise<void> {
  await resetDatabase();
}
