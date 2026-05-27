import { GeneralTab } from './_components/GeneralTab';

/**
 * Aba "Geral" — informações da organização + zona de perigo.
 * Resolução do org pelo slug acontece no client component (usa `useMe`).
 */
export default function SettingsGeneralPage({
  params,
}: {
  params: { slug: string };
}) {
  return <GeneralTab slug={params.slug} />;
}
