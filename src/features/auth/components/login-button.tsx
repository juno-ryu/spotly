import { signInWithGoogle } from "../actions";
import { GoogleIcon } from "@/components/icons/google-icon";

/** Google 로그인 버튼 (Server Component) */
export function LoginButton() {
  return (
    <form action={signInWithGoogle}>
      <button
        type="submit"
        className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 transition-colors"
      >
        <GoogleIcon />
        Google로 시작하기
      </button>
    </form>
  );
}
