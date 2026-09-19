import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { isRoleTab, navigateToRoleTab } from '../components/tabNavigation';

/**
 * Tab-press handlers shared by the worker and employer stacks. Both stacks use
 * these, so they live here rather than inside either one.
 */
function useWorkerTabNavigation() {
  const navigation = useNavigation();
  return useCallback((tab) => {
    if (isRoleTab('worker', tab)) navigateToRoleTab(navigation, 'worker', tab);
  }, [navigation]);
}

function useEmployerTabNavigation() {
  const navigation = useNavigation();
  return useCallback((tab) => {
    if (isRoleTab('employer', tab)) navigateToRoleTab(navigation, 'employer', tab);
  }, [navigation]);
}

export { useWorkerTabNavigation, useEmployerTabNavigation };
