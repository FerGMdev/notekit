import prisma from "@/app/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requireUser } from "@/app/lib/auth";
import { requireAppUser } from "@/app/lib/session";
import SubmitButtons from "@/app/components/SubmitButtons";
import { revalidatePath } from "next/cache";

const COLOR_SCHEMES = [
  { value: "theme-green", label: "Green" },
  { value: "theme-blue", label: "Blue" },
  { value: "theme-violet", label: "Violet" },
  { value: "theme-yellow", label: "Yellow" },
  { value: "theme-rose", label: "Rose" },
  { value: "theme-red", label: "Red" },
  { value: "theme-orange", label: "Orange" },
] as const;

/* Get the user data from the database. */
async function getData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, colorScheme: true },
  });
}

export default async function SettingsPage() {
  const user = await requireAppUser();
  const data = await getData(user.id);

  /* Update the user data in the database. */
  async function onSubmit(formData: FormData) {
    "use server";

    const currentUser = await requireUser();

    const name = String(formData.get("name") ?? "").trim().slice(0, 80);
    const colorScheme = String(formData.get("color") ?? "");

    /* Only the themes the UI can render: a form is untrusted input too. */
    const validScheme = COLOR_SCHEMES.some(
      (scheme) => scheme.value === colorScheme
    )
      ? colorScheme
      : undefined;

    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        ...(name ? { name } : {}),
        ...(validScheme ? { colorScheme: validScheme } : {}),
      },
    });

    /* Revalidate the path to update the color scheme. */
    revalidatePath("/", "layout");
  }

  return (
    <div className="grid items-start gap-8">
      <div className="flex items-center justify-between px-2">
        <div className="grid gap-1">
          <h1 className="text-3xl md:text-4xl tracking-tight">Settings</h1>
          <p className="text-lg text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>
      </div>
      <Card>
        <form action={onSubmit}>
          <CardHeader>
            <CardTitle>General Data</CardTitle>
            <CardDescription>
              Please provide general information about yourself. Please do not
              forget to save after changing anything.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  type="text"
                  name="name"
                  id="name"
                  placeholder="Your Name"
                  maxLength={80}
                  defaultValue={data?.name ?? undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Your Email</Label>
                <Input
                  type="email"
                  name="email"
                  id="email"
                  placeholder="Your Email"
                  disabled
                  defaultValue={data?.email ?? undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color Scheme</Label>
                <Select
                  name="color"
                  defaultValue={data?.colorScheme ?? "theme-violet"}
                >
                  <SelectTrigger id="color">
                    <SelectValue placeholder="Select a color scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {COLOR_SCHEMES.map((scheme) => (
                        <SelectItem key={scheme.value} value={scheme.value}>
                          {scheme.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButtons />
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
