"use client";

import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "../actions";
import { History, LogOut } from "lucide-react";

interface UserMenuProps {
  email: string;
  avatarUrl?: string;
  name?: string;
}

export function UserMenu({ email, avatarUrl, name }: UserMenuProps) {
  const router = useRouter();
  const initial = (name?.[0] ?? email[0] ?? "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <Avatar className="h-10 w-10">
            <AvatarImage src={avatarUrl} alt={name ?? email} />
            <AvatarFallback className="bg-violet-100 text-violet-700 font-semibold">
              {initial}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/history")}>
          <History className="mr-2 h-4 w-4" />
          분석 내역
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut()}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
