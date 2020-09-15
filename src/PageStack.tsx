import React, { useRef, useEffect, useState } from "react";
import { TransitionGroup, CSSTransition } from "react-transition-group";
import { Router } from "next/router";
import Page, { IPageHanderRef } from "./Page";
import { NextComponent, IPageAppContext } from "./type";
import { IRouterInfo } from "./Router";

interface IProps {
  component: NextComponent;
  componentProps: any;
  router: Router;
  contextValue: IPageAppContext; // type.ts로 이도
}

export default function PageStack({
  router,
  component,
  componentProps,
}: IProps) {
  // 각 Page의 페이지 전환 핸들러(ex. componentDidHide)를 담아두기 위한 변수
  const pageHandlerStackRef = useRef<IPageHanderRef[]>([]);
  // 실제 컴포넌트를 쌓아두는 stack 변수
  const [pageStack, setPageStack] = useState<React.ReactElement[]>([]);
  // 브라우저 back, forward할때 필요
  const pageStackInMemory = useRef<React.ReactElement[]>([]);
  const currentPosition = useRef(-1);
  // 페이지 전환 정보 (action, url, direction)
  const pageTransition = useRef<IRouterInfo>();
  // 현재 추가하려는 페이지 정보
  const pageHandler = useRef<IPageHanderRef>(null);

  // 최초 page 추가
  useEffect(() => {
    setPageStack([getPage({ route: router.route, pageComponent: component })]);
    currentPosition.current = 0;
  }, []);

  useEffect(() => {
    const handleHistoryChange = (e: any) => {
      // TODO: type
      // POP을 여기서 하는 이유는 history.back이 호출되었을 때, component는 바뀌지 않기 때문에 기다릴 필요가 없다.
      if (e.detail.action === "POP") {
        const newPageStack = [...pageStack];
        newPageStack.pop();
        setPageStack(newPageStack);
        currentPosition.current = currentPosition.current - 1;
      } else if (e.detail.action === "FORWARD") {
        const nextPosition = currentPosition.current + 1;
        const nextPage = pageStackInMemory.current[nextPosition];
        const newPageStack = [...pageStack];
        newPageStack.push(nextPage);
        setPageStack(newPageStack);
        currentPosition.current = nextPosition;
      } else {
        pageTransition.current = e.detail;
      }
    };
    window.addEventListener("onHistoryChange", handleHistoryChange);
    return () => {
      window.removeEventListener("onHistoryChange", handleHistoryChange);
    };
  }, [pageStack]);

  useEffect(() => {
    if (pageTransition.current) {
      const { action, url, direction } = pageTransition.current;
      const newPageStack = [...pageStack];
      switch (action) {
        case "PUSH":
          url &&
            newPageStack.push(
              getPage({ route: url, pageComponent: component, direction }),
            );
          currentPosition.current = currentPosition.current + 1;
          break;
        case "REPLACE":
          // TODO: page3에서 index 페이지로 replace 요청하는데, page2로 이동한다. 이유를 찾아보자.
          // replace에도 페이지 전환 애니메이션이 필요한지 모르겠다.
          // 만약 필요하다면, push하고 페이지 전환이 완료된 후 이전 페이지를 제거해야한다.
          if (url) {
            const newPage = getPage({
              route: url,
              pageComponent: component,
              isReplace: true,
            });
            newPageStack[newPageStack.length - 1] = newPage;
          }
          break;
        default:
          break;
      }
      setPageStack(newPageStack);
      pageStackInMemory.current = newPageStack;
      pageTransition.current = undefined;
    }
  }, [component]);

  const getPage = ({
    route,
    pageComponent,
    direction = "horizontal",
    isReplace = false,
  }: {
    route: string;
    pageComponent: NextComponent;
    direction?: string;
    isReplace?: boolean;
  }) => {
    direction = pageStack.length === 0 ? "" : direction;
    const index = pageStack.length - 1;
    return (
      <CSSTransition
        key={`${route}_${index}`}
        classNames={direction}
        timeout={400}
        onEntered={() => onEntered()}
        onExited={() => onExited()}
        onEnter={onEnter}
        onExit={onExit}
      >
        <Page
          ref={pageHandler}
          pageComponent={pageComponent}
          componentProps={componentProps}
          route={route}
        />
      </CSSTransition>
    );
  };

  const onEnter = () => {
    const pageHandlerStack = pageHandlerStackRef.current;
    const prevPageHandler = pageHandlerStack[pageHandlerStack.length - 1];
    if (prevPageHandler && prevPageHandler.componentHide) {
      prevPageHandler.componentHide(true);
    }
  };
  const onExit = () => {
    const pageHandlerStack = pageHandlerStackRef.current;
    const prevPageHandler = pageHandlerStack[pageHandlerStack.length - 2];
    if (prevPageHandler && prevPageHandler.componentEnter) {
      prevPageHandler.componentEnter(true);
    }
  };

  const onEntered = () => {
    const pageHandlerStack = pageHandlerStackRef.current;
    pageHandler.current && pageHandlerStack.push(pageHandler.current);
    const prevPageHandler = pageHandlerStack[pageHandlerStack.length - 2];
    if (prevPageHandler && prevPageHandler.componentDidHide) {
      prevPageHandler.componentDidHide(true);
    }
    const currentPageHandler = pageHandlerStack[pageHandlerStack.length - 1];
    if (currentPageHandler && currentPageHandler.componentDidHide) {
      currentPageHandler.componentDidEnter(false);
    }
  };
  const onExited = () => {
    const pageHandlerStack = pageHandlerStackRef.current;
    const currentComponent = pageHandlerStack[pageHandlerStack.length - 1];
    if (currentComponent && currentComponent.componentDidHide) {
      currentComponent.componentDidHide(false);
    }
    const prevComponent = pageHandlerStack[pageHandlerStack.length - 2];
    if (prevComponent && prevComponent.componentDidEnter) {
      prevComponent.componentDidEnter(true);
    }
  };

  return <TransitionGroup>{pageStack}</TransitionGroup>;
}