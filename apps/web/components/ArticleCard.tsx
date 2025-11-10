import Image from 'next/image'
import Link from 'next/link'
import { Article } from '@/types'

interface ArticleCardProps {
  article: Article
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const formatHeatScore = (score: number) => `${score.toFixed(1)}°`
  const getHeatColor = (score: number) => {
    if (score >= 80) return 'text-red-500'
    if (score >= 60) return 'text-yellow-500'
    return 'text-gray-500'
  }

  const formatRelativeTime = (pubTime: string) => {
    const pub = new Date(pubTime)
    const now = new Date()
    const diffHours = (now.getTime() - pub.getTime()) / (1000 * 60 * 60)

    if (diffHours < 1) return '刚刚'
    if (diffHours < 24) return `${Math.floor(diffHours)}小时前`
    if (diffHours < 24 * 7) return `${Math.floor(diffHours / 24)}天前`
    return pub.toLocaleDateString()
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {article.cover && (
          <div className="flex-shrink-0">
            <Image
              src={article.cover}
              alt={article.title}
              width={120}
              height={80}
              className="rounded-lg object-cover"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <Link
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
            >
              {article.title}
            </Link>
            <div className={`flex-shrink-0 font-bold ${getHeatColor(article.proxy_heat)}`}>
              {formatHeatScore(article.proxy_heat)}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
            <span className="font-medium">{article.account.name}</span>
            <span>•</span>
            <span>{formatRelativeTime(article.pub_time)}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <span className="text-yellow-400">{'★'.repeat(article.account.star)}</span>
              <span className="text-gray-400">{'★'.repeat(5 - article.account.star)}</span>
            </div>
          </div>

          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}