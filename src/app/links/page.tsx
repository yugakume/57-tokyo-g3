"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import { LinkIcon, ExternalLinkIcon, SearchIcon } from "@/components/Icons";

export default function LinksPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LinksPageContent />
    </Suspense>
  );
}

function LinksPageContent() {
  const { user, isLoading } = useAuth();
  const { links, categories } = useData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/");
  }, [user, isLoading, router]);

  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) setActiveCategory(cat);
  }, [searchParams]);

  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) => a.order - b.order),
    [categories]
  );

  const filteredLinks = useMemo(() => {
    let result = links;
    if (activeCategory) {
      result = result.filter(l => l.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => a.order - b.order);
  }, [links, activeCategory, search]);

  const groupedLinks = useMemo(() => {
    if (activeCategory) return null;
    const groups: Record<string, typeof links> = {};
    for (const link of filteredLinks) {
      if (!groups[link.category]) groups[link.category] = [];
      groups[link.category].push(link);
    }
    return groups;
  }, [filteredLinks, activeCategory]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name ?? "";

  return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">業務リンク集</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">支部業務に必要なリンクを一覧から探せます</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="リンクを検索..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !activeCategory
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            すべて
          </button>
          {sortedCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Links display */}
        {filteredLinks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <p className="text-sm text-gray-500">該当するリンクが見つかりませんでした</p>
          </div>
        ) : activeCategory ? (
          /* Single category view */
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                {getCategoryName(activeCategory)}
              </h2>
              <p className="text-xs text-gray-400">{filteredLinks.length}件</p>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {filteredLinks.map((link) => (
                <LinkCard key={link.id} link={link} />
              ))}
            </div>
          </div>
        ) : (
          /* Grouped view */
          <div className="space-y-4">
            {sortedCategories.map((cat) => {
              const catLinks = groupedLinks?.[cat.id];
              if (!catLinks || catLinks.length === 0) return null;
              return (
                <div key={cat.id} className="bg-white rounded-xl border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{cat.name}</h2>
                    {cat.description && (
                      <p className="text-xs text-gray-400">{cat.description}</p>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {catLinks.map((link) => (
                      <LinkCard key={link.id} link={link} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}

function LinkCard({ link }: { link: import("@/types").LinkItem }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors group"
    >
      <div className="w-9 h-9 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
        <LinkIcon type={link.icon} className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 transition-colors truncate">
          {link.title}
        </p>
        {link.description && (
          <p className="text-xs text-gray-400 truncate">{link.description}</p>
        )}
      </div>
      <ExternalLinkIcon className="w-4 h-4 text-gray-300 group-hover:text-blue-400 shrink-0" />
    </a>
  );
}
