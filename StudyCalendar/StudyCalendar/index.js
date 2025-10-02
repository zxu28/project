import { registerRootComponent } from 'expo';

import App from './App';
import React from 'react';
import { AssignmentsProvider } from './AssignmentsContext';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
const Root = () => (
  <AssignmentsProvider>
    <App />
  </AssignmentsProvider>
);

registerRootComponent(Root);
