import OnboardingStepScreen from './OnboardingStepScreen';

type Screen3Props = {
  onNext: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  onLogin?: () => void;
};

export default function Screen3({ onNext, onPrevious, onSkip, onLogin }: Screen3Props) {
  return (
    <OnboardingStepScreen
      activeIndex={2}
      icon="shield"
      title={'Safe & Verified\nTransactions'}
      subtitle={'Every profile is verified so you can work and hire with full confidence.'}
      buttonLabel="Continue"
      onNext={onNext}
      onPrevious={onPrevious}
      onSkip={onSkip}
      onLogin={onLogin}
    />
  );
}
