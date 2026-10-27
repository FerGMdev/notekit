import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  FileText,
  LogOutIcon,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { LogoutLink } from "@kinde-oss/kinde-auth-nextjs/components";

export const navItems = [
  {
    icon: FileText,
    label: "Notes",
    href: "/dashboard",
  },
  {
    icon: Sparkles,
    label: "Ask",
    href: "/dashboard/ask",
  },
  {
    icon: Trash2,
    label: "Trash",
    href: "/dashboard/trash",
  },
  {
    icon: Settings,
    label: "Settings",
    href: "/dashboard/settings",
  },
  {
    icon: CreditCard,
    label: "Billing",
    href: "/dashboard/billing",
  },
];

export default function UserNav({
  user,
  email,
  imageUrl,
  isDemo = false,
}: {
  user: string;
  email: string;
  imageUrl: string;
  isDemo?: boolean;
}) {
  const initials = user.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 rounded-full">
            <AvatarImage src={imageUrl} alt="" />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {navItems.map((item) => (
            <DropdownMenuItem asChild key={item.href}>
              <Link
                href={item.href}
                className="w-full flex justify-between items-center"
              >
                {item.label}
                <item.icon className="w-4 h-4" />
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {isDemo ? (
          <DropdownMenuItem disabled className="justify-between">
            <span>Demo mode</span>
            <span className="text-xs text-muted-foreground">local</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem className="w-full flex justify-between items-center" asChild>
            <LogoutLink className="flex items-center gap-x-2">
              <span>Log out</span>
              <LogOutIcon className="w-4 h-4" />
            </LogoutLink>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
