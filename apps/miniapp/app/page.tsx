import { MockWalletRepository } from "@wallet/core";

import { AppProviders } from "../src/app-providers";

export default async function Page() {
  const snapshot = await new MockWalletRepository().getSnapshot();

  return <AppProviders snapshot={snapshot} />;
}
