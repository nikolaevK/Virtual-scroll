import { useState } from "react";
import GridDynamicColumn from "./examples/GridDynamicColumn";
import GridDynamicRow from "./examples/GridDynamicRow";
import Medium from "./examples/Medium";
import Simple from "./examples/Simple";

const state = {
  simple: <Simple />,
  medium: <Medium />,
  gridDynamicColumn: <GridDynamicColumn />,
  gridDynamicRow: <GridDynamicRow />,
};

function App() {
  const [example, setExample] = useState();
  return (
    <>
      <button
        className="p-2 mt-2 text-white bg-black"
        onClick={(e) => setExample(e.currentTarget.innerText)}
      >
        simple
      </button>
      <button
        className="p-2 mt-2 text-white bg-black"
        onClick={(e) => setExample(e.currentTarget.innerText)}
      >
        medium
      </button>
      <button
        className="p-2 mt-2 text-white bg-black"
        onClick={(e) => setExample(e.currentTarget.innerText)}
      >
        gridDynamicColumn
      </button>
      <button
        className="p-2 mt-2 text-white bg-black"
        onClick={(e) => setExample(e.currentTarget.innerText)}
      >
        gridDynamicRow
      </button>

      {!!example ? state[example] : <Simple />}
    </>
  );
}

export default App;
