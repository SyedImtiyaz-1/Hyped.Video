import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { creditsFor, TRIAL_CREDITS } from "@launchreel/core/pricing";
import { RECIPE_CATEGORIES, RECIPES, recipeById } from "@launchreel/core/recipes";
import { voiceById } from "@launchreel/core/voices";
import { RATIO, TIER_LABEL } from "@/components/recipes/labels";
import { RecipeSample, RecipeStory } from "@/components/recipes/recipe-sample";
import { ButtonLink } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { plural } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

export const generateStaticParams = () => RECIPES.map((r) => ({ id: r.id }));

export async function generateMetadata({ params }: Props) {
  const r = recipeById((await params).id);
  return r ? { title: `${r.name}: a video recipe`, description: `${r.pitch}. Made from your real product by ${BRAND.name}.` } : {};
}

/** A recipe's public page: its sample, its story and the way to make your own (sign-up first, then the recipe's panel). */
export default async function PublicRecipePage({ params }: Props) {
  const r = recipeById((await params).id);
  if (!r) notFound();
  const voice = voiceById(r.video?.voice);
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-12 md:px-8 md:py-16">
      <Link href="/recipes" className="inline-flex items-center gap-1.5 text-sm text-gray-900 hover:text-gray-1000">
        <ArrowLeft className="size-4" /> All recipes
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
        <RecipeSample recipe={r} />
        <div>
          <p className="text-sm font-medium text-brand">{RECIPE_CATEGORIES.find((c) => c.value === r.category)?.label}</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">{r.name}</h1>
          <p className="mt-3 text-lg text-gray-900">{r.pitch}</p>
          <ul className="mt-5 flex flex-wrap gap-1.5 text-[13px] text-gray-900">
            <li className="rounded-full border border-gray-alpha-400 px-2.5 py-0.5">{TIER_LABEL[r.tier]}</li>
            <li className="rounded-full border border-gray-alpha-400 px-2.5 py-0.5 tabular-nums">{r.durationSec}s</li>
            <li className="rounded-full border border-gray-alpha-400 px-2.5 py-0.5">{RATIO[r.format]}</li>
            {r.kind === "video" && <li className="rounded-full border border-gray-alpha-400 px-2.5 py-0.5">{voice ? `${voice.name} voiceover` : "No voiceover"}</li>}
            <li className="rounded-full border border-gray-alpha-400 px-2.5 py-0.5 tabular-nums">{r.kind === "video" ? plural(creditsFor("newVideo", r.durationSec, r.tier), "credit") : "Reel"}</li>
          </ul>
          {r.status === "live" ? (
            <ButtonLink href={`/dashboard/recipes/${r.id}`} variant="primary" size="lg" className="mt-8">
              Make yours <ArrowRight />
            </ButtonLink>
          ) : (
            <p className="mt-8 inline-flex h-12 items-center rounded-md border border-dashed border-gray-alpha-500 px-6 text-gray-900">Coming soon</p>
          )}
          <p className="mt-3 text-[13px] text-gray-900">{TRIAL_CREDITS} free credits to start, no card needed. Recipes are free; a video costs the usual credits.</p>
          {r.video && (
            <>
              <h2 className="mb-3 mt-10 text-base font-semibold">The story</h2>
              <RecipeStory recipe={r} />
            </>
          )}
          <p className="mt-6 text-[13px] text-gray-900">Made for {r.platforms.join(", ")}. Every shape and length can be changed before you make it.</p>
        </div>
      </div>
    </main>
  );
}
