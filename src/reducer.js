// @flow
import type { Location, LocationOptions, LocationAction } from './types';

import qs from 'query-string';

import {
  LOCATION_CHANGED,
  REPLACE_ROUTES,
  DID_REPLACE_ROUTES,
  isNavigationActionWithPayload
} from './types';

const flow = (...funcs: Array<*>) =>
  funcs.reduce((prev, curr) => (...args) => curr(prev(...args)));

type ResolverArgs = {
  oldLocation: Location,
  newLocation: Location,
  options: LocationOptions
};

const resolveQuery = ({ oldLocation, newLocation, options }): ResolverArgs => {
  // Merge the old and new queries if asked to persist
  if (options.persistQuery) {
    const mergedQuery = {
      ...oldLocation.query,
      ...newLocation.query
    };
    return {
      oldLocation,
      newLocation: {
        ...newLocation,
        query: mergedQuery,
        search: `?${qs.stringify(mergedQuery)}`
      },
      options
    };
  }

  return {
    oldLocation,
    newLocation: {
      ...newLocation,
      query: newLocation.query || {}
    },
    options
  };
};

const resolveBasename = ({
  oldLocation,
  newLocation,
  options
}): ResolverArgs => {
  const { basename } = oldLocation;
  if (basename) {
    return {
      oldLocation,
      newLocation: { basename, ...newLocation },
      options
    };
  }
  return { oldLocation, newLocation, options };
};

const resolvePrevious = ({
  oldLocation,
  newLocation,
  options
}): ResolverArgs => ({
  oldLocation,
  newLocation: {
    ...newLocation,
    previous: oldLocation
  },
  options
});

const locationChangeReducer = (state, action) => {
  // No-op the initial route action
  if (
    state.pathname === action.payload.pathname &&
    state.search === action.payload.search &&
    state.hash === action.payload.hash &&
    (!state.queue || !state.queue.length)
  ) {
    return state;
  }

  const queuedLocation = (state.queue && state.queue[0]) || {};
  const queue = (state.queue && state.queue.slice(1)) || [];

  // Extract the previous state, but dump the
  // previous state's previous state so that the
  // state tree doesn't keep growing indefinitely
  // eslint-disable-next-line no-unused-vars
  const { previous, routes: currentRoutes = {}, ...oldLocation } = state;
  const { options, query } = queuedLocation;

  const resolveLocation = flow(resolveQuery, resolveBasename, resolvePrevious);

  const { newLocation } = resolveLocation({
    oldLocation,
    newLocation: {
      ...action.payload,
      query
    },
    options: options || {}
  });

  return { ...newLocation, routes: currentRoutes, queue };
};

type ReducerArgs = {|
  routes: Object,
  initialLocation: Location
|};

export default ({ routes = {}, initialLocation }: ReducerArgs = {}) => (
  state: Location = { ...initialLocation, routes, queue: [] },
  action: LocationAction
) => {
  if (isNavigationActionWithPayload(action)) {
    return {
      ...state,
      queue: state.queue && state.queue.concat([action.payload])
    };
  }

  if (action.type === REPLACE_ROUTES) {
    return {
      ...state,
      routes: action.payload.routes,
      options: action.payload.options
    };
  }

  if (action.type === DID_REPLACE_ROUTES) {
    return { ...state, options: {} };
  }

  if (action.type === LOCATION_CHANGED) {
    return locationChangeReducer(state, action);
  }

  return state;
};
