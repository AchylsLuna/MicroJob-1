import OnboardingStepScreen from './OnboardingStepScreen';

type Screen2Props = {
  onNext: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  onLogin?: () => void;
};

export default function Screen2({ onNext, onPrevious, onSkip, onLogin }: Screen2Props) {
  return (
    <OnboardingStepScreen
      activeIndex={1}
      icon="users"
      title={'Hire Top Talent\nFast'}
      subtitle={'Post a job and get matched with verified professionals in minutes.'}
      buttonLabel="Continue"
      onNext={onNext}
      onPrevious={onPrevious}
      onSkip={onSkip}
      onLogin={onLogin}
    />
  );
}
