import React, { createContext, useContext, useMemo, useState } from 'react';

const AssignmentsContext = createContext({
  assignments: [],
  assignmentStatus: {},
  setAssignmentStatus: () => {},
});

export const AssignmentsProvider = ({ children, initialAssignments = [] }) => {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [assignmentStatus, setAssignmentStatusState] = useState({});

  const setAssignmentStatus = (id, newStatus) => {
    setAssignmentStatusState(prev => ({ ...prev, [id]: newStatus }));
  };

  const value = useMemo(() => ({ assignments, assignmentStatus, setAssignmentStatus }), [assignments, assignmentStatus]);

  return (
    <AssignmentsContext.Provider value={value}>
      {children}
    </AssignmentsContext.Provider>
  );
};

export const useAssignments = () => useContext(AssignmentsContext);


