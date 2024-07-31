/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 *      
 */

                                                

import ReactSharedInternals from 'shared/ReactSharedInternals';
import {getStackByFiberInDevAndProd} from './ReactFiberComponentStack';
import getComponentNameFromFiber from 'react-reconciler/src/getComponentNameFromFiber';

const ReactDebugCurrentFrame = ReactSharedInternals.ReactDebugCurrentFrame;

export let current               = null;
export let isRendering          = false;

export function getCurrentFiberOwnerNameInDevOrNull()                {
  if (__DEV__) {
    if (current === null) {
      return null;
    }
    const owner = current._debugOwner;
    if (owner !== null && typeof owner !== 'undefined') {
      return getComponentNameFromFiber(owner);
    }
  }
  return null;
}

function getCurrentFiberStackInDev()         {
  if (__DEV__) {
    if (current === null) {
      return '';
    }
    // Safe because if current fiber exists, we are reconciling,
    // and it is guaranteed to be the work-in-progress version.
    return getStackByFiberInDevAndProd(current);
  }
  return '';
}

export function resetCurrentFiber() {
  if (__DEV__) {
    ReactDebugCurrentFrame.getCurrentStack = null;
    current = null;
    isRendering = false;
  }
}

export function setCurrentFiber(fiber              ) {
  if (__DEV__) {
    ReactDebugCurrentFrame.getCurrentStack =
      fiber === null ? null : getCurrentFiberStackInDev;
    current = fiber;
    isRendering = false;
  }
}

export function getCurrentFiber()               {
  if (__DEV__) {
    return current;
  }
  return null;
}

export function setIsRendering(rendering         ) {
  if (__DEV__) {
    isRendering = rendering;
  }
}

export function getIsRendering()                 {
  if (__DEV__) {
    return isRendering;
  }
}
