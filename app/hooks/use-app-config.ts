import { useCallback, useMemo } from "react";
import { GaloyInstance, resolveGaloyInstanceOrDefault } from "@app/config";
import { usePersistentStateContext } from "@app/store/persistent-state";

export const useAppConfig = () => {
  const { persistentState, updateState } = usePersistentStateContext();

  const appConfig = useMemo(() => ({
    token: persistentState.galoyAuthToken,
    galoyInstance: resolveGaloyInstanceOrDefault(persistentState.galoyInstance),
  }), [persistentState.galoyAuthToken, persistentState.galoyInstance]);

  const setGaloyInstance = useCallback((newInstance: GaloyInstance) => {
    updateState((state) => ({
      ...state,
      galoyInstance: newInstance,
    }));
  }, [updateState]);

  const saveToken = useCallback((token: string) => {
    updateState((state) => ({
      ...state,
      galoyAuthToken: token,
    }));
  }, [updateState]);

  const saveTokenAndInstance = useCallback(({ token, instance }: { token: string; instance: GaloyInstance }) => {
    updateState((state) => ({
      ...state,
      galoyInstance: instance,
      galoyAuthToken: token,
    }));
  }, [updateState]);

  return {
    appConfig,
    setGaloyInstance,
    saveToken,
    saveTokenAndInstance,
  };
};
