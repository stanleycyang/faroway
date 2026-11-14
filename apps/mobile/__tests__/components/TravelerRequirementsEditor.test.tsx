import React, { useState } from 'react';
import { act, create } from 'react-test-renderer';
import type { TravelerRequirements } from '@faroway/types';
import { TravelerRequirementsEditor } from '../../components/TravelerRequirementsEditor';
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

it('keeps multiline entry editable and preserves independent needs when controls change', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let saved: TravelerRequirements | undefined;
  function Harness() {
    const [value, setValue] = useState<TravelerRequirements>();
    saved = value;
    return <TravelerRequirementsEditor value={value} onChange={setValue} />;
  }
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<Harness />);
    });
    const field = (label: string) => renderer.root.findByProps({ accessibilityLabel: label });
    await act(async () => {
      field('Food allergies').props.onChangeText('Peanuts\n');
    });
    expect(field('Food allergies').props.value).toBe('Peanuts\n');
    await act(async () => {
      field('Food allergies').props.onChangeText('Peanuts\nSesame');
    });
    await act(async () => {
      field('Dietary preferences').props.onChangeText('Vegan');
    });
    await act(async () => {
      field('Step-free entrance').props.onPress();
    });
    expect(field('Step-free entrance').props.accessibilityState.checked).toBe(true);
    await act(async () => {
      field('Mobility and rest needs').props.onChangeText('Rest every 30 minutes');
    });
    expect(saved).toEqual({
      allergies: ['Peanuts', 'Sesame'],
      dietaryPreferences: ['Vegan'],
      accessibility: ['step_free_entrance'],
      mobilityNotes: 'Rest every 30 minutes',
    });
    await act(async () => {
      field('Step-free entrance').props.onPress();
    });
    expect(saved?.accessibility).toEqual([]);
    expect(saved?.allergies).toEqual(['Peanuts', 'Sesame']);
    await act(async () => {
      field('Food allergies').props.onChangeText('x'.repeat(101));
    });
    expect(renderer.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1);
    expect(field('Food allergies').props.value).toHaveLength(101);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

it('updates fields when a different pending brief is restored', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<TravelerRequirementsEditor onChange={() => {}} />);
    });
    await act(async () => {
      renderer.update(
        <TravelerRequirementsEditor
          value={{
            allergies: ['Sesame'],
            dietaryPreferences: [],
            accessibility: [],
            mobilityNotes: '',
          }}
          onChange={() => {}}
        />
      );
    });
    expect(renderer.root.findByProps({ accessibilityLabel: 'Food allergies' }).props.value).toBe(
      'Sesame'
    );
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

it('retains multiple edits delivered before React renders again', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let saved: TravelerRequirements | undefined;
  function Harness() {
    const [value, setValue] = useState<TravelerRequirements>();
    saved = value;
    return <TravelerRequirementsEditor value={value} onChange={setValue} />;
  }
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<Harness />);
    });
    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Food allergies' })
        .props.onChangeText('Peanuts');
      renderer.root.findByProps({ accessibilityLabel: 'Step-free entrance' }).props.onPress();
      renderer.root.findByProps({ accessibilityLabel: 'Accessible restroom' }).props.onPress();
    });
    expect(saved?.allergies).toEqual(['Peanuts']);
    expect(saved?.accessibility).toEqual(['step_free_entrance', 'accessible_restroom']);
    await act(async () => {
      const press = renderer.root.findByProps({ accessibilityLabel: 'Step-free entrance' }).props
        .onPress;
      press();
      press();
    });
    expect(saved?.accessibility).toContain('step_free_entrance');
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

it('keeps empty optional fields collapsed but exposes restored needs automatically', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let screen!: ReturnType<typeof create>;
  try {
    await act(async () => {
      screen = create(<TravelerRequirementsEditor collapsible onChange={() => {}} />);
    });
    expect(screen.root.findAllByProps({ accessibilityLabel: 'Food allergies' })).toHaveLength(0);
    const disclosure = screen.root.findByProps({ accessibilityRole: 'button' });
    expect(disclosure.props.accessibilityState.expanded).toBe(false);
    await act(async () => disclosure.props.onPress());
    expect(screen.root.findAllByProps({ accessibilityLabel: 'Food allergies' })).toHaveLength(1);
    await act(async () => screen.root.findByProps({ accessibilityRole: 'button' }).props.onPress());
    await act(async () => {
      screen.update(
        <TravelerRequirementsEditor
          collapsible
          value={{
            allergies: ['Peanuts'],
            dietaryPreferences: [],
            accessibility: [],
            mobilityNotes: '',
          }}
          onChange={() => {}}
        />
      );
    });
    expect(screen.root.findByProps({ accessibilityLabel: 'Food allergies' }).props.value).toBe(
      'Peanuts'
    );
  } finally {
    await act(async () => screen?.unmount());
  }
});
