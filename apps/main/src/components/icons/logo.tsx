import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const Logo = ({
  iconOnly = false,
  isLink = true,
}: {
  iconOnly?: boolean;
  isLink?: boolean;
}) => {
  const pathname = usePathname();
  const link = isLink ? "/" : pathname;
  return (
    <Link href={link} className="flex items-center gap-1">
      <Image
        src="/logo.webp"
        alt="Logo"
        width={768}
        height={672}
        className="size-8 aspect-square"
        priority
      />
      {iconOnly ? null : (
        <p className="flex items-center text-sm font-bold">
          <span className="text-foreground">reion</span>
        </p>
      )}
    </Link>
  );
};

export default Logo;
