import OnboardingStepScreen from './OnboardingStepScreen';

type Screen4Props = {
  onNext: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  onLogin?: () => void;
};

export default function Screen4({ onNext, onPrevious, onSkip, onLogin }: Screen4Props) {
  return (
    <OnboardingStepScreen
      activeIndex={3}
      icon="trending-up"
      title={'Grow Your\nCareer'}
      subtitle={'Track applications, build your profile, and unlock your next opportunity.'}
      buttonLabel="Continue"
      onNext={onNext}
      onPrevious={onPrevious}
      onSkip={onSkip}
      onLogin={onLogin}
    />
  );
}
