import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const items = Array.from({ length: 10_000 }, (_, index) => ({
  id: Math.random().toString(36).slice(2),
  text: String(index),
}));

const ITEM_HEIGHT = 40;
const CONTAINER_HEIGHT = 600;
const OVERSCAN = 3;

export default function Simple() {
  const [listItems, setListItems] = useState(items);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrolling, setScrolling] = useState(false);

  const scrollElementRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scrollElement = scrollElementRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const scrollTop = scrollElement.scrollTop;
      setScrollTop(scrollTop);
    };

    handleScroll();

    scrollElement.addEventListener("scroll", handleScroll);

    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, []);

  // Show loading indicator when user scrolls, in order to not load extra data/content
  // or for example if images are loading
  useEffect(() => {
    const scrollElement = scrollElementRef.current;

    if (!scrollElement) return;

    let timeoutId: NodeJS.Timeout | null = null;

    const handleScrollingLoadIndicator = () => {
      setScrolling(true);

      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        setScrolling(false);
      }, 250);
    };

    scrollElement.addEventListener("scroll", handleScrollingLoadIndicator);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      scrollElement.removeEventListener("scroll", handleScrollingLoadIndicator);
    };
  }, []);

  const virtualItems = useMemo(() => {
    const rangeStart = scrollTop; // position of a scroll on the top of the container, from the top of the items scrolled
    const rangeEnd = scrollTop + CONTAINER_HEIGHT; // distance scrolled from the beginning plus size of the container to account for its size

    // Find and calculate the beginning position where elements range should start
    // Find and calculate the end position where elements range should end
    let startIndex = Math.floor(rangeStart / ITEM_HEIGHT);
    let endIndex = Math.ceil(rangeEnd / ITEM_HEIGHT);

    // Accounting for potential negative number when startIndex 0
    startIndex = Math.max(0, startIndex - OVERSCAN);
    endIndex = Math.min(listItems.length - 1, endIndex + OVERSCAN);

    let virtualItems: { index: number; offsetTop: number }[] = [];

    for (let index = startIndex; index <= endIndex; index++) {
      virtualItems.push({
        index,
        offsetTop: index * ITEM_HEIGHT,
      });
    }

    return virtualItems;
  }, [scrollTop, listItems.length]);

  const TOTAL_LIST_HEIGHT = items.length * ITEM_HEIGHT;

  return (
    <div className="px-3 py-0">
      <h1>List</h1>
      <div className="mb-3">
        <button
          className="p-2 bg-red-300 rounded-sm"
          onClick={() => setListItems((items) => [...items].reverse())}
        >
          reverse
        </button>
      </div>
      {/* scroll container */}
      <div
        className={"relative overflow-auto border border-solid border-gray-300"}
        style={{
          height: `${CONTAINER_HEIGHT}px`,
        }}
        ref={scrollElementRef}
      >
        <div
          style={{
            height: TOTAL_LIST_HEIGHT,
          }}
        >
          {virtualItems.map((virtualItem) => {
            let item = listItems[virtualItem.index];

            return (
              <div
                key={item.id}
                className={`absolute top-0 h-[${ITEM_HEIGHT}px] py-1.5 px-3`}
                // offset is needed to display the item in a right place within the container
                style={{
                  transform: `translateY(${virtualItem.offsetTop}px)`,
                  height: `${ITEM_HEIGHT}`,
                }}
              >
                {scrolling ? "loading..." : item.text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
