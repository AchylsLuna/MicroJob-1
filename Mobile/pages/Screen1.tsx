import OnboardingStepScreen from './OnboardingStepScreen';

type Screen1Props = {
  onNext: () => void;
  onSkip?: () => void;
  onLogin?: () => void;
};

export default function Screen1({ onNext, onSkip, onLogin }: Screen1Props) {
  return (
    <OnboardingStepScreen
      activeIndex={0}
      icon="briefcase"
      title={'Find Work\nYou Love'}
      subtitle={'Connect with thousands of employers looking for your skills and expertise.'}
      buttonLabel="Get Started"
      showArrow={false}
      onNext={onNext}
      onSkip={onSkip}
      onLogin={onLogin}
    />
  );
}
