/* "STEP 3 OF 7 · LOCATION" plus a thin progress rule — the one piece of
   orientation a multi-step mobile form needs, kept small enough that it
   never competes with the step's own content for attention. */
export default function StepIndicator({ steps, currentIndex }) {
  const step = steps[currentIndex];
  return (
    <div className="wizard-steps">
      <div className="wizard-steps__head">
        <span className="wizard-steps__count">
          Step {currentIndex + 1} of {steps.length}
        </span>
        <span className="wizard-steps__label">{step.label}</span>
      </div>
      <div className="wizard-steps__track">
        {steps.map((s, index) => (
          <span
            key={s.key}
            className={`wizard-steps__dot${index === currentIndex ? ' is-current' : ''}${
              index < currentIndex ? ' is-done' : ''
            }`}
          />
        ))}
      </div>
    </div>
  );
}
