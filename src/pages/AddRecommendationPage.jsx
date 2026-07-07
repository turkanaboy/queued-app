import { RecommendationComposer } from '../components/RecommendationComposer'
import { ScreenHeader } from '../lib/queuedDesign'

export default function AddRecommendationPage() {
  return (
    <div className="pb-5">
      <ScreenHeader title="Recommend" subtitle="Send a title to a friend" />
      <RecommendationComposer />
    </div>
  )
}
