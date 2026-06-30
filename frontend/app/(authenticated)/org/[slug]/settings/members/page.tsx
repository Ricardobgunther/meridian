import { MembersTab } from '../_components/MembersTab';

/**
 * Aba "Membros" — lista paginada, filtros e ações de role/remoção.
 */
export default function SettingsMembersPage({
  params,
}: {
  params: { slug: string };
}) {
  return <MembersTab slug={params.slug} />;
}
