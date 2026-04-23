function StepEditor({ steps, onChange }) {
  const stepTypes = ['navigate', 'click', 'fill', 'wait'];

  const addStep = () => {
    const newStep = {
      step_type: 'navigate',
      selector: '',
      value: '',
      order: steps.length + 1
    };
    onChange([...steps, newStep]);
  };

  const updateStep = (index, field, value) => {
    const updatedSteps = [...steps];
    updatedSteps[index][field] = value;
    onChange(updatedSteps);
  };

  const removeStep = (index) => {
    const updatedSteps = steps.filter((_, i) => i !== index);
    // Update order numbers
    updatedSteps.forEach((step, i) => step.order = i + 1);
    onChange(updatedSteps);
  };

  return (
    <div>
      <div style={{marginBottom: '12px', fontWeight: 'bold'}}>
        Test Steps ({steps.length})
      </div>
      
      {steps.map((step, index) => (
        <div
          key={index}
          style={{
            border: '1px solid #ddd',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '8px',
            background: '#fafafa'
          }}
        >
          <div style={{marginBottom: '8px', fontSize: '12px', color: '#666'}}>
            Step {step.order}
          </div>
          
          <select
            value={step.step_type}
            onChange={(e) => updateStep(index, 'step_type', e.target.value)}
            style={{
              width: '100%',
              padding: '6px',
              marginBottom: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          >
            {stepTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder="Selector (optional for navigate, wait)"
            value={step.selector}
            onChange={(e) => updateStep(index, 'selector', e.target.value)}
            style={{
              width: '100%',
              padding: '6px',
              marginBottom: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
          
          <input
            type="text"
            placeholder="Value"
            value={step.value}
            onChange={(e) => updateStep(index, 'value', e.target.value)}
            style={{
              width: '100%',
              padding: '6px',
              marginBottom: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          />
          
          <button
            onClick={() => removeStep(index)}
            style={{
              padding: '4px 8px',
              background: '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Remove
          </button>
        </div>
      ))}
      
      <button
        onClick={addStep}
        style={{
          width: '100%',
          padding: '8px',
          background: '#2196f3',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        + Add Step
      </button>
    </div>
  );
}

export default StepEditor;
