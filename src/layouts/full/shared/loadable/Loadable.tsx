/* eslint-disable react/display-name */
// U5 mechanical lint header (odd/tasks/gerencial-template-import.md L2): the repo lint config
// targets the musician side; this file is template code kept verbatim (S1), so the rule fires
// it raises are disabled here rather than rewritten or weakened repo-wide in the lint config.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore

import { Suspense, ComponentType, FC } from 'react';
import Spinner from '../../../../views/spinner/Spinner';

// ===========================|| LOADABLE - LAZY LOADING ||=========================== //

const Loadable =
  <P extends object>(Component: ComponentType<P>): FC<P> =>
  (props: P) =>
    (
      <Suspense fallback={<Spinner />}>
        <Component {...props} />
      </Suspense>
    );

export default Loadable;
