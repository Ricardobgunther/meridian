'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Monitor, Moon, Sun, User, Check } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/t';
import { Avatar } from '@/components/ui/Avatar';
import { useUiStore, type Theme } from '@/lib/stores/ui-store';
import { createClient } from '@/lib/supabase/client';
import { setCurrentOrgId } from '@/lib/org/current';
import { parseApiError } from '@/lib/api/errors';
import { SpinnerIcon } from '@/app/_icons/SpinnerIcon';

interface UserMenuProps {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  userId: string;
}

const THEME_OPTIONS: Array<{
  value: Theme;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: 'light', label: t.shell.userMenu.themeLight, Icon: Sun },
  { value: 'dark', label: t.shell.userMenu.themeDark, Icon: Moon },
  { value: 'system', label: t.shell.userMenu.themeSystem, Icon: Monitor },
];

/**
 * Menu da conta no topbar. Avatar do usuário → header + atalhos + tema + sair.
 * Logout limpa storage da org ativa para evitar fantasma na próxima sessão.
 */
export function UserMenu({ email, name, avatarUrl, userId }: UserMenuProps) {
  const router = useRouter();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setCurrentOrgId(null);
      router.push('/login');
      router.refresh();
    } catch (err) {
      setSigningOut(false);
      const parsed = parseApiError(err);
      toast.error(parsed.title, { description: parsed.message });
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t.shell.userMenu.trigger}
          className="rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <Avatar
            seed={userId}
            label={name?.trim() || email}
            imageUrl={avatarUrl}
            size={32}
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={cn(
            'z-dropdown w-56 rounded-lg border border-border bg-surface-elevated p-1 shadow-lg',
            'data-[state=open]:animate-slide-up motion-reduce:animate-none',
          )}
        >
          <DropdownMenu.Label className="flex items-center gap-3 px-3 py-2">
            <Avatar
              seed={userId}
              label={name?.trim() || email}
              imageUrl={avatarUrl}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {name?.trim() || email}
              </p>
              <p className="truncate text-xs text-text-muted">{email}</p>
            </div>
          </DropdownMenu.Label>

          <DropdownMenu.Separator className="mx-2 my-1 h-px bg-border" />

          <DropdownMenu.Item
            onSelect={() => router.push('/me')}
            className={menuItemClasses()}
          >
            <User className="h-4 w-4" aria-hidden="true" />
            {t.shell.userMenu.account}
          </DropdownMenu.Item>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={menuItemClasses()}>
              <Monitor className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1">{t.shell.userMenu.theme}</span>
              <span className="text-xs text-text-muted capitalize">
                {THEME_OPTIONS.find((o) => o.value === theme)?.label}
              </span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                sideOffset={4}
                className="z-dropdown w-44 rounded-lg border border-border bg-surface-elevated p-1 shadow-lg"
              >
                <DropdownMenu.RadioGroup
                  value={theme}
                  onValueChange={(v) => setTheme(v as Theme)}
                >
                  {THEME_OPTIONS.map(({ value, label, Icon }) => (
                    <DropdownMenu.RadioItem
                      key={value}
                      value={value}
                      className={menuItemClasses()}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span className="flex-1">{label}</span>
                      {theme === value && (
                        <Check
                          className="h-4 w-4 text-accent"
                          aria-hidden="true"
                        />
                      )}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator className="mx-2 my-1 h-px bg-border" />

          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              void handleSignOut();
            }}
            disabled={signingOut}
            className={cn(
              menuItemClasses(),
              'text-danger hover:text-danger focus:text-danger',
            )}
          >
            {signingOut ? (
              <SpinnerIcon className="h-4 w-4" />
            ) : (
              <LogOut className="h-4 w-4" aria-hidden="true" />
            )}
            {signingOut ? t.shell.userMenu.loggingOut : t.shell.userMenu.logout}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function menuItemClasses() {
  return cn(
    'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary',
    'hover:bg-surface-sunken focus:bg-surface-sunken focus:outline-none',
    'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
  );
}
